import { describe, expect, it, vi } from 'vitest';

import {
  buildOutboxDependencies,
  buildOutboxEvent,
} from '../../../test/helpers/dispatch-outbox.fixtures';

import {
  DispatchOutboxEventsUseCase,
  type DispatchOutboxEventsInput,
} from './dispatch-outbox-events.use-case';

const NOW = new Date('2026-09-05T14:00:00.000Z');
const INPUT: DispatchOutboxEventsInput = {
  now: NOW,
  batchSize: 50,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 5000,
};

describe('DispatchOutboxEventsUseCase', () => {
  it('publishes due events and marks them as published', async () => {
    const dependencies = buildOutboxDependencies();
    const event = buildOutboxEvent();
    vi.mocked(dependencies.outbox.findDue).mockResolvedValue([{ event, attemptCount: 0 }]);
    const useCase = new DispatchOutboxEventsUseCase(
      dependencies.outbox,
      dependencies.publisher,
      dependencies.logger,
    );
    await useCase.execute(INPUT);
    expect(dependencies.publisher.publish).toHaveBeenCalledWith(event);
    expect(dependencies.outbox.markPublished).toHaveBeenCalledWith(event.eventId, NOW);
    expect(dependencies.logger.published).toHaveBeenCalledWith(
      expect.objectContaining({ event, attempt: 1 }),
    );
  });

  it('persists a sanitized retry and keeps processing the batch', async () => {
    const dependencies = buildOutboxDependencies();
    const failedEvent = buildOutboxEvent();
    const publishedEvent = buildOutboxEvent();
    vi.mocked(dependencies.outbox.findDue).mockResolvedValue([
      { event: failedEvent, attemptCount: 0 },
      { event: publishedEvent, attemptCount: 0 },
    ]);
    vi.mocked(dependencies.publisher.publish)
      .mockRejectedValueOnce(new Error('broker unavailable'))
      .mockResolvedValueOnce({ topic: publishedEvent.eventName, partition: 0, offset: '2' });
    const useCase = new DispatchOutboxEventsUseCase(
      dependencies.outbox,
      dependencies.publisher,
      dependencies.logger,
    );
    await useCase.execute(INPUT);
    expect(dependencies.outbox.scheduleRetry).toHaveBeenCalledWith({
      eventId: failedEvent.eventId,
      nextAttemptAt: new Date('2026-09-05T14:00:01.000Z'),
      lastError: JSON.stringify({ code: 'Error', message: 'broker unavailable' }),
    });
    expect(dependencies.outbox.markPublished).toHaveBeenCalledWith(publishedEvent.eventId, NOW);
    expect(dependencies.logger.publicationFailed).toHaveBeenCalledOnce();
    expect(dependencies.logger.retryScheduled).toHaveBeenCalledOnce();
  });

  it('caps retry delay and reports a possible duplicate on repeated publication', async () => {
    const dependencies = buildOutboxDependencies();
    const event = buildOutboxEvent();
    vi.mocked(dependencies.outbox.findDue).mockResolvedValue([{ event, attemptCount: 6 }]);
    vi.mocked(dependencies.publisher.publish).mockRejectedValue(new Error('timeout'));
    const useCase = new DispatchOutboxEventsUseCase(
      dependencies.outbox,
      dependencies.publisher,
      dependencies.logger,
    );
    await useCase.execute(INPUT);
    expect(dependencies.logger.possibleDuplicate).toHaveBeenCalledWith({ event, attempt: 7 });
    expect(dependencies.outbox.scheduleRetry).toHaveBeenCalledWith(
      expect.objectContaining({ nextAttemptAt: new Date('2026-09-05T14:00:05.000Z') }),
    );
  });

  it('logs a sanitized dispatcher failure when the outbox cannot be read', async () => {
    const dependencies = buildOutboxDependencies();
    vi.mocked(dependencies.outbox.findDue).mockRejectedValue('database offline');
    const useCase = new DispatchOutboxEventsUseCase(
      dependencies.outbox,
      dependencies.publisher,
      dependencies.logger,
    );
    await expect(useCase.execute(INPUT)).resolves.toBeUndefined();
    expect(dependencies.logger.dispatcherFailed).toHaveBeenCalledWith({
      code: 'UNKNOWN_ERROR',
      message: 'Unknown publication error',
    });
  });
});
