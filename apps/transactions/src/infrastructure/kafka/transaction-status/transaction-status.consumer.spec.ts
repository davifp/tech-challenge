import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createTransactionStatusConsumer,
  type KafkaConsumer,
} from './kafkajs-status-consumer.factory';
import { type TransactionStatusConsumerConfig } from './transaction-status-consumer.config';
import { type TransactionStatusMessageProcessor } from './transaction-status-message.processor';
import { TransactionStatusConsumer } from './transaction-status.consumer';

vi.mock('./kafkajs-status-consumer.factory', () => ({
  createTransactionStatusConsumer: vi.fn(),
}));

const CONFIG: TransactionStatusConsumerConfig = {
  brokers: ['localhost:9092'],
  clientId: 'transactions-test',
  groupId: 'transactions-test',
  connectionTimeoutMs: 3000,
  requestTimeoutMs: 30000,
  retryInitialTimeMs: 300,
  retryCount: 5,
  sessionTimeoutMs: 30000,
  maxAttempts: 3,
  retryDelayMs: 10,
  enabled: true,
};

function fakeConsumer(connect: KafkaConsumer['connect']): KafkaConsumer {
  return {
    connect,
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    commitOffsets: vi.fn().mockResolvedValue(undefined),
  };
}

function buildSubject(connect: KafkaConsumer['connect']) {
  const kafkaConsumer = fakeConsumer(connect);
  vi.mocked(createTransactionStatusConsumer).mockReturnValue(kafkaConsumer);
  const processor = { process: vi.fn() } as unknown as TransactionStatusMessageProcessor;
  return { subject: new TransactionStatusConsumer(CONFIG, processor), kafkaConsumer };
}

function capturedRestartOnFailure() {
  const restartOnFailure = vi.mocked(createTransactionStatusConsumer).mock.calls[0]?.[1];
  if (!restartOnFailure) throw new Error('restartOnFailure was not configured');
  return restartOnFailure;
}

describe('TransactionStatusConsumer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('starts in background without blocking application bootstrap', async () => {
    const context = buildSubject(vi.fn().mockResolvedValue(undefined));
    expect(context.subject.onApplicationBootstrap()).toBeUndefined();
    const restartOnFailure = capturedRestartOnFailure();
    await expect(restartOnFailure(new Error('consumer crashed'))).resolves.toBe(true);
    expect(context.kafkaConsumer.connect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.kafkaConsumer.connect).toHaveBeenCalledOnce();
    expect(context.kafkaConsumer.run).toHaveBeenCalledWith({
      autoCommit: false,
      eachMessage: expect.any(Function),
    });
    await context.subject.beforeApplicationShutdown();
    await expect(restartOnFailure(new Error('consumer crashed'))).resolves.toBe(false);
  });

  it('schedules another connection when Kafka is initially unavailable', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);
    const context = buildSubject(connect);
    context.subject.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.kafkaConsumer.disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(CONFIG.retryDelayMs);
    expect(connect).toHaveBeenCalledTimes(2);
    await context.subject.beforeApplicationShutdown();
  });
});
