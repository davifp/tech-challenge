import {
  transactionStatusUpdatedV1Schema,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';

import { type KafkaRecord } from './kafka-record';
import { PermanentKafkaMessageError } from './permanent-kafka-message.error';

export function parseTransactionStatusRecord(record: KafkaRecord): TransactionStatusUpdatedV1 {
  if (record.topic !== TRANSACTION_STATUS_UPDATED_TOPIC) {
    throw new PermanentKafkaMessageError('UNSUPPORTED_TOPIC', 'Kafka topic is not supported');
  }
  if (record.value === null) {
    throw new PermanentKafkaMessageError('INVALID_EVENT', 'Kafka event value is missing');
  }
  const event = parseValue(record.value);
  assertCorrelation(event);
  assertKey(record.key, event);
  return event;
}

function parseValue(value: string): TransactionStatusUpdatedV1 {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value) as unknown;
  } catch {
    throw new PermanentKafkaMessageError('INVALID_EVENT', 'Kafka event is not valid JSON');
  }
  const result = transactionStatusUpdatedV1Schema.safeParse(decoded);
  if (!result.success) {
    throw new PermanentKafkaMessageError('INVALID_EVENT', 'Kafka event contract is invalid');
  }
  return result.data;
}

function assertCorrelation(event: TransactionStatusUpdatedV1): void {
  if (event.correlationId !== event.data.transactionExternalId) {
    throw new PermanentKafkaMessageError('INVALID_CORRELATION', 'Kafka correlation is invalid');
  }
}

function assertKey(key: string | null, event: TransactionStatusUpdatedV1): void {
  if (key !== event.data.transactionExternalId) {
    throw new PermanentKafkaMessageError('INVALID_KEY', 'Kafka message key is invalid');
  }
}
