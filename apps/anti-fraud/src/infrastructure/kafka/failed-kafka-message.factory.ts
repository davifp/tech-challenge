import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_CREATED_TOPIC,
  type FailedKafkaMessageV1,
} from '@tech-challenge/event-contracts';

import { type KafkaRecord } from './kafka-record';
import { sanitizeKafkaError } from './sanitize-kafka-error';

type FailedMessageInput = {
  record: KafkaRecord;
  error: unknown;
  attempts: number;
  failedAt: Date;
};

export function createFailedKafkaMessage(input: FailedMessageInput): FailedKafkaMessageV1 {
  return {
    version: INTEGRATION_EVENT_VERSION,
    sourceTopic: TRANSACTION_CREATED_TOPIC,
    partition: input.record.partition,
    offset: input.record.offset,
    originalKey: input.record.key,
    originalValue: input.record.value ?? '',
    attempts: input.attempts,
    failedAt: input.failedAt.toISOString(),
    error: sanitizeKafkaError(input.error),
  };
}
