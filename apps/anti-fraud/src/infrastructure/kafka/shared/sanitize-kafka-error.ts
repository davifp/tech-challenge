import { type FailedKafkaMessageErrorV1 } from '@tech-challenge/event-contracts';

import { PermanentKafkaMessageError } from './permanent-kafka-message.error';

const MAX_ERROR_MESSAGE_LENGTH = 200;

export function sanitizeKafkaError(error: unknown): FailedKafkaMessageErrorV1 {
  if (error instanceof PermanentKafkaMessageError) {
    return { code: error.code, message: truncate(error.message) };
  }
  if (error instanceof Error) {
    return { code: error.name || 'ERROR', message: truncate(error.message) };
  }
  return { code: 'UNKNOWN_ERROR', message: 'Unknown Kafka processing error' };
}

function truncate(message: string): string {
  return message.slice(0, MAX_ERROR_MESSAGE_LENGTH);
}
