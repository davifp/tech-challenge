import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OutboxDispatcherRunner,
  type OutboxDispatcher,
  type OutboxRunnerConfig,
  type PublisherLifecycle,
} from './outbox-dispatcher.runner';

const CONFIG: OutboxRunnerConfig = {
  enabled: true,
  pollIntervalMs: 1000,
  batchSize: 50,
  retryBaseDelayMs: 1000,
  retryMaxDelayMs: 60000,
};

describe('OutboxDispatcherRunner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts without awaiting Kafka and prevents overlapping cycles', async () => {
    let finishDispatch: (() => void) | undefined;
    const dispatchPromise = new Promise<void>((resolve) => {
      finishDispatch = resolve;
    });
    const dispatch: OutboxDispatcher = { execute: vi.fn().mockReturnValue(dispatchPromise) };
    const publisher: PublisherLifecycle = { disconnect: vi.fn().mockResolvedValue(undefined) };
    const runner = new OutboxDispatcherRunner(dispatch, publisher, CONFIG);
    expect(runner.onApplicationBootstrap()).toBeUndefined();
    await vi.advanceTimersByTimeAsync(0);
    expect(dispatch.execute).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(CONFIG.pollIntervalMs * 2);
    expect(dispatch.execute).toHaveBeenCalledOnce();
    const shutdown = runner.onApplicationShutdown();
    expect(publisher.disconnect).not.toHaveBeenCalled();
    finishDispatch?.();
    await shutdown;
    expect(publisher.disconnect).toHaveBeenCalledOnce();
  });

  it('runs periodically after the previous cycle completes', async () => {
    const dispatch: OutboxDispatcher = { execute: vi.fn().mockResolvedValue(undefined) };
    const publisher: PublisherLifecycle = { disconnect: vi.fn().mockResolvedValue(undefined) };
    const runner = new OutboxDispatcherRunner(dispatch, publisher, CONFIG);
    runner.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(CONFIG.pollIntervalMs);
    expect(dispatch.execute).toHaveBeenCalledTimes(2);
    await runner.onApplicationShutdown();
  });
});
