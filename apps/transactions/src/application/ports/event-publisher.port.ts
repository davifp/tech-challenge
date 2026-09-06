import { type TransactionCreatedV1 } from '@tech-challenge/event-contracts';

export const EVENT_PUBLISHER = Symbol('EventPublisher');

export type PublishedEventMetadata = {
  topic: string;
  partition: number;
  offset: string;
};

export interface EventPublisher {
  publish(event: TransactionCreatedV1): Promise<PublishedEventMetadata>;
}
