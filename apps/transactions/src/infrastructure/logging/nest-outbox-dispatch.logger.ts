import { Injectable, Logger } from '@nestjs/common';

import {
  type OutboxDispatchLogger,
  type OutboxFailureContext,
  type OutboxLogContext,
  type OutboxPublishedContext,
  type OutboxRetryContext,
  type SanitizedError,
} from '../../application/ports/outbox-dispatch-logger.port';

@Injectable()
export class NestOutboxDispatchLogger implements OutboxDispatchLogger {
  private readonly logger = new Logger(NestOutboxDispatchLogger.name);

  published(context: OutboxPublishedContext): void {
    this.logger.log({
      ...eventFields(context),
      ...context.metadata,
      outcome: 'published',
    });
  }

  possibleDuplicate(context: OutboxLogContext): void {
    this.logger.warn({ ...eventFields(context), outcome: 'possible_duplicate' });
  }

  publicationFailed(context: OutboxFailureContext): void {
    this.logger.error({
      ...eventFields(context),
      outcome: 'publication_failed',
      error: context.error,
    });
  }

  retryScheduled(context: OutboxRetryContext): void {
    this.logger.warn({
      ...eventFields(context),
      outcome: 'retry_scheduled',
      nextAttemptAt: context.nextAttemptAt.toISOString(),
      error: context.error,
    });
  }

  dispatcherFailed(error: SanitizedError): void {
    this.logger.error({ eventName: 'outbox.dispatch', outcome: 'failed', error });
  }
}

function eventFields(context: OutboxLogContext) {
  return {
    eventName: context.event.eventName,
    eventId: context.event.eventId,
    transactionExternalId: context.event.data.transactionExternalId,
    correlationId: context.event.correlationId,
    topic: context.event.eventName,
    attempt: context.attempt,
  };
}
