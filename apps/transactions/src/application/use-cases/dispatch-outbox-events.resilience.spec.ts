import { describe, expect, it, vi } from 'vitest';

import {
  buildOutboxDependencies,
  buildOutboxEvent,
} from '../../../test/helpers/dispatch-outbox.fixtures';

import { DispatchOutboxEventsUseCase } from './dispatch-outbox-events.use-case';

describe('DispatchOutboxEventsUseCase resilience', () => {
  it('continues the batch when persisting one retry fails', async () => {
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
    vi.mocked(dependencies.outbox.scheduleRetry).mockRejectedValueOnce(
      new Error('database unavailable'),
    );
    const useCase = new DispatchOutboxEventsUseCase(
      dependencies.outbox,
      dependencies.publisher,
      dependencies.logger,
    );
    const now = new Date('2026-09-05T14:00:00.000Z');
    await useCase.execute({
      now,
      batchSize: 50,
      retryBaseDelayMs: 1000,
      retryMaxDelayMs: 5000,
    });
    expect(dependencies.logger.dispatcherFailed).toHaveBeenCalledWith({
      code: 'Error',
      message: 'database unavailable',
    });
    expect(dependencies.outbox.markPublished).toHaveBeenCalledWith(publishedEvent.eventId, now);
  });
});
