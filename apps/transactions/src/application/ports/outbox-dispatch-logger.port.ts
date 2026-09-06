import { type TransactionCreatedV1 } from '@tech-challenge/event-contracts';

import { type PublishedEventMetadata } from './event-publisher.port';

export const OUTBOX_DISPATCH_LOGGER = Symbol('OutboxDispatchLogger');

export type OutboxLogContext = {
  event: TransactionCreatedV1;
  attempt: number;
};

export type OutboxFailureContext = OutboxLogContext & {
  error: SanitizedError;
};

export type OutboxPublishedContext = OutboxLogContext & {
  metadata: PublishedEventMetadata;
};

export type OutboxRetryContext = OutboxFailureContext & {
  nextAttemptAt: Date;
};

export type SanitizedError = { code: string; message: string };

export interface OutboxDispatchLogger {
  published(context: OutboxPublishedContext): void;
  possibleDuplicate(context: OutboxLogContext): void;
  publicationFailed(context: OutboxFailureContext): void;
  retryScheduled(context: OutboxRetryContext): void;
  dispatcherFailed(error: SanitizedError): void;
}
