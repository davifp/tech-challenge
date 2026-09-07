import { randomUUID } from 'node:crypto';

import {
  deadLetterTopicFor,
  failedKafkaMessageV1Schema,
  transactionStatusUpdatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
} from '@tech-challenge/event-contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { env } from '../../src/infrastructure/config/env.loader';
import { nextOffset } from '../../src/infrastructure/kafka/kafka-record';
import { type KafkaClientConfig } from '../../src/infrastructure/kafka/kafka.config';
import { createAntiFraudKafkaRuntime } from '../helpers/anti-fraud-kafka-runtime';
import { KafkaEventProbe } from '../helpers/kafka-event-probe';
import { KafkaTestHarness } from '../helpers/kafka-test-harness';
import { transactionCreatedEvent } from '../helpers/transaction-created-event.fixture';

const DEAD_LETTER_TOPIC = deadLetterTopicFor(TRANSACTION_CREATED_TOPIC);
const clientConfig = (suffix: string): KafkaClientConfig => ({
  brokers: env.KAFKA_BROKERS,
  clientId: `${env.KAFKA_CLIENT_ID}-${suffix}`,
  connectionTimeoutMs: env.KAFKA_CONNECTION_TIMEOUT_MS,
  requestTimeoutMs: env.KAFKA_REQUEST_TIMEOUT_MS,
  retryInitialTimeMs: env.KAFKA_RETRY_INITIAL_TIME_MS,
  retryCount: env.KAFKA_RETRY_COUNT,
});

describe('anti-fraud Kafka flow', () => {
  const suffix = randomUUID();
  const groupId = `${env.KAFKA_GROUP_ID_ANTI_FRAUD}-${suffix}`;
  const config = clientConfig(suffix);
  const { publisher, consumer } = createAntiFraudKafkaRuntime(config, {
    ...config,
    groupId,
    sessionTimeoutMs: env.KAFKA_SESSION_TIMEOUT_MS,
    maxAttempts: 3,
    retryDelayMs: 10,
  });
  const harness = new KafkaTestHarness({
    brokers: config.brokers,
    clientId: `${config.clientId}-input`,
  });
  const probe = new KafkaEventProbe({
    brokers: config.brokers,
    clientId: `${config.clientId}-probe`,
    groupId: `${groupId}-probe`,
  });

  beforeAll(async () => {
    await harness.connect();
    await harness.ensureTopics([
      TRANSACTION_CREATED_TOPIC,
      TRANSACTION_STATUS_UPDATED_TOPIC,
      DEAD_LETTER_TOPIC,
    ]);
    await probe.start([TRANSACTION_STATUS_UPDATED_TOPIC, DEAD_LETTER_TOPIC]);
    await consumer.start();
  });

  afterAll(async () => {
    await consumer.onModuleDestroy();
    await publisher.onModuleDestroy();
    await probe.disconnect();
    await harness.disconnect();
  });

  it.each([
    { value: 1000, expectedStatus: 'approved' },
    { value: 1000.01, expectedStatus: 'rejected' },
  ])('TI-04 publishes a correlated $expectedStatus decision', async ({ value, expectedStatus }) => {
    const transactionExternalId = randomUUID();
    const event = transactionCreatedEvent({ eventId: randomUUID(), transactionExternalId, value });
    await harness.publish(TRANSACTION_CREATED_TOPIC, transactionExternalId, JSON.stringify(event));
    const received = await probe.waitFor(TRANSACTION_STATUS_UPDATED_TOPIC, transactionExternalId);
    const decision = transactionStatusUpdatedV1Schema.parse(JSON.parse(received.value) as unknown);
    expect(decision.data).toEqual({ transactionExternalId, status: expectedStatus });
    expect(decision.correlationId).toBe(transactionExternalId);
    expect(decision.causationId).toBe(event.eventId);
  });

  it('TI-06 publishes an invalid event to DLQ before committing its source offset', async () => {
    const key = randomUUID();
    await harness.publish(TRANSACTION_CREATED_TOPIC, key, '{invalid-json');
    const received = await probe.waitFor(DEAD_LETTER_TOPIC, key);
    const failed = failedKafkaMessageV1Schema.parse(JSON.parse(received.value) as unknown);
    expect(failed).toMatchObject({ originalKey: key, originalValue: '{invalid-json', attempts: 1 });
    expect(failed.error.code).toBe('INVALID_EVENT');
    await expect
      .poll(() => harness.committedOffset(groupId, failed.sourceTopic, failed.partition))
      .toBe(nextOffset(failed.offset));
  });
});
