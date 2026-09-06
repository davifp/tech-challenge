import { PermanentKafkaMessageError } from './permanent-kafka-message.error';

export type KafkaFailureAction = 'retry' | 'dead-letter';

export function classifyKafkaFailure(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): KafkaFailureAction {
  if (error instanceof PermanentKafkaMessageError) return 'dead-letter';
  return attempt < maxAttempts ? 'retry' : 'dead-letter';
}

export function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
