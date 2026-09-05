import { sanitizeOutboxError, serializeSanitizedError } from '../helpers/sanitize-outbox-error';
import { type EventPublisher } from '../ports/event-publisher.port';
import { type OutboxDispatchLogger } from '../ports/outbox-dispatch-logger.port';
import {
  type OutboxEventRepository,
  type PendingOutboxEvent,
} from '../ports/outbox-event.repository.port';

export type DispatchOutboxEventsInput = {
  now: Date;
  batchSize: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
};

export class DispatchOutboxEventsUseCase {
  constructor(
    private readonly outbox: OutboxEventRepository,
    private readonly publisher: EventPublisher,
    private readonly logger: OutboxDispatchLogger,
  ) {}

  async execute(input: DispatchOutboxEventsInput): Promise<void> {
    const pendingEvents = await this.findDue(input);
    for (const pending of pendingEvents) await this.dispatchSafely(pending, input);
  }

  private async findDue(input: DispatchOutboxEventsInput): Promise<PendingOutboxEvent[]> {
    try {
      return await this.outbox.findDue({ dueAt: input.now, limit: input.batchSize });
    } catch (error) {
      this.logger.dispatcherFailed(sanitizeOutboxError(error));
      return [];
    }
  }

  private async dispatchSafely(
    pending: PendingOutboxEvent,
    input: DispatchOutboxEventsInput,
  ): Promise<void> {
    try {
      await this.dispatch(pending, input);
    } catch (error) {
      this.logger.dispatcherFailed(sanitizeOutboxError(error));
    }
  }

  private async dispatch(
    pending: PendingOutboxEvent,
    input: DispatchOutboxEventsInput,
  ): Promise<void> {
    const attempt = pending.attemptCount + 1;
    if (pending.attemptCount > 0) this.logger.possibleDuplicate({ event: pending.event, attempt });
    try {
      const metadata = await this.publisher.publish(pending.event);
      await this.outbox.markPublished(pending.event.eventId, input.now);
      this.logger.published({ event: pending.event, attempt, metadata });
    } catch (error) {
      await this.scheduleRetry({ pending, attempt, error, input });
    }
  }

  private async scheduleRetry(context: RetryContext): Promise<void> {
    const { pending, attempt, input } = context;
    const sanitizedError = sanitizeOutboxError(context.error);
    const nextAttemptAt = nextRetryAt(input, attempt);
    this.logger.publicationFailed({ event: pending.event, attempt, error: sanitizedError });
    await this.outbox.scheduleRetry({
      eventId: pending.event.eventId,
      nextAttemptAt,
      lastError: serializeSanitizedError(sanitizedError),
    });
    this.logger.retryScheduled({
      event: pending.event,
      attempt,
      error: sanitizedError,
      nextAttemptAt,
    });
  }
}

type RetryContext = {
  pending: PendingOutboxEvent;
  attempt: number;
  error: unknown;
  input: DispatchOutboxEventsInput;
};

function nextRetryAt(input: DispatchOutboxEventsInput, attempt: number): Date {
  const exponent = Math.min(attempt - 1, 30);
  const delay = Math.min(input.retryBaseDelayMs * 2 ** exponent, input.retryMaxDelayMs);
  return new Date(input.now.getTime() + delay);
}
