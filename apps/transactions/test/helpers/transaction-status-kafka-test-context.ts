import { randomUUID } from 'node:crypto';

import { ConfigService } from '@nestjs/config';
import {
  deadLetterTopicFor,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from '@tech-challenge/event-contracts';

import { ApplyTransactionStatusUseCase } from '../../src/application/use-cases/apply-transaction-status.use-case';
import { type Env } from '../../src/infrastructure/config/env.schema';
import { type TransactionStatusConsumerConfig } from '../../src/infrastructure/kafka/transaction-status/transaction-status-consumer.config';

import { KafkaEventProbe } from './kafka-event.probe';
import { KafkaTestHarness } from './kafka-test-harness';
import { createTransactionsTestApp } from './test-app';
import { createTransactionStatusKafkaRuntime } from './transaction-status-kafka-runtime';

export async function createTransactionStatusKafkaTestContext() {
  const testApp = await createTransactionsTestApp();
  const configService = testApp.app.get<ConfigService<Env, true>>(ConfigService);
  const suffix = randomUUID();
  const config = buildConfig(configService, suffix);
  const { harness, probe } = buildKafkaTestAdapters(config);
  const runtime = createTransactionStatusKafkaRuntime(
    config,
    testApp.app.get(ApplyTransactionStatusUseCase),
  );
  await harness.connect();
  await harness.ensureTopics([
    TRANSACTION_STATUS_UPDATED_TOPIC,
    deadLetterTopicFor(TRANSACTION_STATUS_UPDATED_TOPIC),
  ]);
  await probe.start(deadLetterTopicFor(TRANSACTION_STATUS_UPDATED_TOPIC));
  await runtime.consumer.start();
  const close = async () => {
    await runtime.consumer.beforeApplicationShutdown();
    await runtime.deadLetterPublisher.onApplicationShutdown();
    await probe.disconnect();
    await harness.disconnect();
    await testApp.app.close();
  };
  return { app: testApp.app, config, harness, probe, close };
}

function buildKafkaTestAdapters(config: TransactionStatusConsumerConfig) {
  const harness = new KafkaTestHarness({
    brokers: config.brokers,
    clientId: `${config.clientId}-input`,
  });
  const probe = new KafkaEventProbe({
    brokers: config.brokers,
    clientId: `${config.clientId}-probe`,
  });
  return { harness, probe };
}

function buildConfig(
  config: ConfigService<Env, true>,
  suffix: string,
): TransactionStatusConsumerConfig {
  return {
    brokers: config.get('KAFKA_BROKERS', { infer: true }),
    clientId: `${config.get('KAFKA_CLIENT_ID', { infer: true })}-${suffix}`,
    groupId: `${config.get('KAFKA_GROUP_ID_TRANSACTIONS', { infer: true })}-${suffix}`,
    connectionTimeoutMs: config.get('KAFKA_CONNECTION_TIMEOUT_MS', { infer: true }),
    requestTimeoutMs: config.get('KAFKA_REQUEST_TIMEOUT_MS', { infer: true }),
    retryInitialTimeMs: config.get('KAFKA_RETRY_INITIAL_TIME_MS', { infer: true }),
    retryCount: config.get('KAFKA_RETRY_COUNT', { infer: true }),
    sessionTimeoutMs: config.get('KAFKA_SESSION_TIMEOUT_MS', { infer: true }),
    maxAttempts: 3,
    retryDelayMs: 10,
    enabled: true,
  };
}
