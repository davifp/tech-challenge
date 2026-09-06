import { type INestApplication } from '@nestjs/common';
import {
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from '@tech-challenge/event-contracts';

import { type AntiFraudE2eRuntime, createAntiFraudE2eRuntime } from './anti-fraud-e2e-runtime';
import { configureKafkaE2eEnvironment, type KafkaE2eEnvironment } from './kafka-e2e-environment';
import { KafkaEventProbe } from './kafka-event.probe';
import { KafkaTestHarness } from './kafka-test-harness';
import { createTransactionsTestApp } from './test-app';

export type FullKafkaFlowContext = {
  app: INestApplication;
  environment: KafkaE2eEnvironment;
  harness: KafkaTestHarness;
  probe: KafkaEventProbe;
  close: () => Promise<void>;
};

export async function createFullKafkaFlowContext(): Promise<FullKafkaFlowContext> {
  const environment = configureKafkaE2eEnvironment();
  const harness = new KafkaTestHarness({
    brokers: environment.brokers,
    clientId: `${environment.clientId}-harness`,
  });
  const probe = new KafkaEventProbe({
    brokers: environment.brokers,
    clientId: `${environment.clientId}-probe`,
    groupId: environment.probeGroupId,
  });
  const antiFraud = createAntiFraudE2eRuntime(environment);
  let app: INestApplication | undefined;
  try {
    await prepareKafka(harness, probe, antiFraud);
    app = (await createTransactionsTestApp({ enableKafkaRuntime: true })).app;
    await harness.waitForActiveGroups(environment.activeGroupIds);
    return buildContext({ app, environment, harness, probe, antiFraud });
  } catch (error: unknown) {
    await closeResources({ app, antiFraud, probe, harness, environment });
    throw error;
  }
}

async function prepareKafka(
  harness: KafkaTestHarness,
  probe: KafkaEventProbe,
  antiFraud: AntiFraudE2eRuntime,
): Promise<void> {
  await harness.connect();
  await harness.ensureTopics([TRANSACTION_CREATED_TOPIC, TRANSACTION_STATUS_UPDATED_TOPIC]);
  await probe.start([TRANSACTION_CREATED_TOPIC, TRANSACTION_STATUS_UPDATED_TOPIC]);
  await antiFraud.publisher.onModuleInit();
  await antiFraud.consumer.start();
}

function buildContext(input: {
  app: INestApplication;
  environment: KafkaE2eEnvironment;
  harness: KafkaTestHarness;
  probe: KafkaEventProbe;
  antiFraud: AntiFraudE2eRuntime;
}): FullKafkaFlowContext {
  let closed = false;
  return {
    ...input,
    close: async () => {
      if (closed) return;
      closed = true;
      await closeResources(input);
    },
  };
}

async function closeResources(input: {
  app?: INestApplication;
  antiFraud: AntiFraudE2eRuntime;
  probe: KafkaEventProbe;
  harness: KafkaTestHarness;
  environment: KafkaE2eEnvironment;
}): Promise<void> {
  const results = await Promise.allSettled([
    input.app?.close(),
    input.antiFraud.consumer.onModuleDestroy(),
    input.antiFraud.publisher.onModuleDestroy(),
    input.probe.disconnect(),
    input.harness.disconnect(),
  ]);
  input.environment.restore();
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      'Kafka E2E cleanup failed',
    );
  }
}
