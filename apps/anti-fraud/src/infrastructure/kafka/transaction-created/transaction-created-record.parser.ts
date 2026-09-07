import {
  transactionCreatedV1Schema,
  TRANSACTION_CREATED_TOPIC,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';

import { type KafkaRecord } from '../shared/kafka-record';
import { PermanentKafkaMessageError } from '../shared/permanent-kafka-message.error';

export function parseTransactionCreatedRecord(record: KafkaRecord): TransactionCreatedV1 {
  if (record.topic !== TRANSACTION_CREATED_TOPIC) {
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

function parseValue(value: string): TransactionCreatedV1 {
  let decoded: unknown;
  try {
    decoded = JSON.parse(value) as unknown;
  } catch {
    throw new PermanentKafkaMessageError('INVALID_EVENT', 'Kafka event is not valid JSON');
  }
  const result = transactionCreatedV1Schema.safeParse(decoded);
  if (!result.success) {
    throw new PermanentKafkaMessageError('INVALID_EVENT', 'Kafka event contract is invalid');
  }
  return result.data;
}

function assertCorrelation(event: TransactionCreatedV1): void {
  if (event.correlationId !== event.data.transactionExternalId) {
    throw new PermanentKafkaMessageError('INVALID_CORRELATION', 'Kafka correlation is invalid');
  }
}

function assertKey(key: string | null, event: TransactionCreatedV1): void {
  if (key !== event.data.transactionExternalId) {
    throw new PermanentKafkaMessageError('INVALID_KEY', 'Kafka message key is invalid');
  }
}
