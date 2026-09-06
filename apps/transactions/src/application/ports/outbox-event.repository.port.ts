import { type TransactionCreatedV1 } from '@tech-challenge/event-contracts';

export const OUTBOX_EVENT_REPOSITORY = Symbol('OutboxEventRepository');

export type PendingOutboxEvent = {
  event: TransactionCreatedV1;
  attemptCount: number;
};

export type FindDueOutboxEventsInput = {
  dueAt: Date;
  limit: number;
};

export type ScheduleOutboxRetryInput = {
  eventId: string;
  nextAttemptAt: Date;
  lastError: string;
};

export interface OutboxEventRepository {
  findDue(input: FindDueOutboxEventsInput): Promise<PendingOutboxEvent[]>;
  markPublished(eventId: string, publishedAt: Date): Promise<void>;
  scheduleRetry(input: ScheduleOutboxRetryInput): Promise<void>;
}
