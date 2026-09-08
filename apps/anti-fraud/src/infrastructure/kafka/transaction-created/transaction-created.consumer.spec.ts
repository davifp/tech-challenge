import { type Consumer, type ConsumerConfig, type Kafka } from 'kafkajs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type TransactionCreatedConsumerConfig } from '../shared/kafka.config';
import { createKafkaClient } from '../shared/kafkajs-client.factory';

import { type TransactionCreatedMessageProcessor } from './transaction-created-message.processor';
import { TransactionCreatedConsumer } from './transaction-created.consumer';

vi.mock('../shared/kafkajs-client.factory', () => ({
  createKafkaClient: vi.fn(),
}));

const CONFIG: TransactionCreatedConsumerConfig = {
  brokers: ['localhost:9092'],
  clientId: 'anti-fraud-test',
  groupId: 'anti-fraud-test',
  connectionTimeoutMs: 3000,
  requestTimeoutMs: 30000,
  retryInitialTimeMs: 300,
  retryCount: 5,
  sessionTimeoutMs: 30000,
  maxAttempts: 3,
  retryDelayMs: 10,
};

type KafkaConsumer = Pick<
  Consumer,
  'connect' | 'subscribe' | 'run' | 'disconnect' | 'commitOffsets'
>;

function fakeConsumer(overrides: Partial<KafkaConsumer> = {}): KafkaConsumer {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    commitOffsets: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildSubject(overrides: Partial<KafkaConsumer> = {}) {
  const kafkaConsumer = fakeConsumer(overrides);
  let configuredConsumer: ConsumerConfig | undefined;
  const kafka = {
    consumer: vi.fn((config: ConsumerConfig) => {
      configuredConsumer = config;
      return kafkaConsumer as Consumer;
    }),
  } as unknown as Kafka;
  vi.mocked(createKafkaClient).mockReturnValue(kafka);
  const processor = { process: vi.fn() } as unknown as TransactionCreatedMessageProcessor;
  const subject = new TransactionCreatedConsumer(CONFIG, processor);
  if (!configuredConsumer) throw new Error('Kafka consumer was not configured');
  return { subject, kafkaConsumer, configuredConsumer };
}

describe('TransactionCreatedConsumer lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('starts in background and disables crash restarts during shutdown', async () => {
    const context = buildSubject();
    expect(context.subject.onApplicationBootstrap()).toBeUndefined();
    const restartOnFailure = context.configuredConsumer.retry?.restartOnFailure;
    if (!restartOnFailure) throw new Error('restartOnFailure was not configured');
    await expect(restartOnFailure(new Error('consumer crashed'))).resolves.toBe(true);
    expect(context.kafkaConsumer.connect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.kafkaConsumer.connect).toHaveBeenCalledOnce();
    expect(context.kafkaConsumer.run).toHaveBeenCalledWith({
      autoCommit: false,
      eachMessage: expect.any(Function),
    });
    await context.subject.onModuleDestroy();
    await expect(restartOnFailure(new Error('consumer crashed'))).resolves.toBe(false);
  });

  it('schedules another connection when Kafka is initially unavailable', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);
    const context = buildSubject({ connect });
    context.subject.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    expect(context.kafkaConsumer.disconnect).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(CONFIG.retryDelayMs);
    expect(connect).toHaveBeenCalledTimes(2);
    await context.subject.onModuleDestroy();
  });

  it('cancels a scheduled connection during shutdown', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('unavailable'));
    const context = buildSubject({ connect });
    context.subject.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);
    await context.subject.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(CONFIG.retryDelayMs);
    expect(connect).toHaveBeenCalledOnce();
  });

  it('disconnects and preserves the startup error when direct startup fails', async () => {
    const startupError = new Error('subscription failed');
    const context = buildSubject({
      subscribe: vi.fn().mockRejectedValue(startupError),
      disconnect: vi.fn().mockRejectedValue(new Error('disconnect failed')),
    });
    await expect(context.subject.start()).rejects.toBe(startupError);
    expect(context.kafkaConsumer.disconnect).toHaveBeenCalledOnce();
  });
});
