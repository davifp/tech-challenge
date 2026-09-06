import { TRANSACTION_STATUS_UPDATED_TOPIC } from '@tech-challenge/event-contracts';
import { z } from 'zod';

import { type KafkaRecord } from './kafka-record';
import { sanitizeKafkaError } from './sanitize-kafka-error';

const uuidSchema = z.uuid();

export function kafkaCorrelationContext(record: KafkaRecord) {
  const transactionExternalId = uuidSchema.safeParse(record.key);
  if (!transactionExternalId.success) return {};
  return {
    transactionExternalId: transactionExternalId.data,
    correlationId: transactionExternalId.data,
  };
}

export function kafkaFailureContext(
  record: KafkaRecord,
  error: unknown,
  attempt: number,
  outcome: string,
) {
  return {
    eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
    topic: record.topic,
    partition: record.partition,
    offset: record.offset,
    ...kafkaCorrelationContext(record),
    attempt,
    outcome,
    error: sanitizeKafkaError(error),
  };
}

export function kafkaConsumerLifecycleContext(outcome: string) {
  return { component: 'kafka_consumer', topic: TRANSACTION_STATUS_UPDATED_TOPIC, outcome };
}
