import { type FailedKafkaMessageV1 } from '@tech-challenge/event-contracts';

export const DEAD_LETTER_PUBLISHER = Symbol('DeadLetterPublisher');

export interface DeadLetterPublisher {
  publishDeadLetter(message: FailedKafkaMessageV1): Promise<void>;
}
