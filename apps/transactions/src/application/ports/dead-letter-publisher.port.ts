import { type FailedKafkaMessageV1 } from '@tech-challenge/event-contracts';

export interface DeadLetterPublisher {
  publishDeadLetter(message: FailedKafkaMessageV1): Promise<void>;
}
