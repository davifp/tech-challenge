import { randomUUID } from 'node:crypto';

import {
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';
import { type Kafka, type Producer } from 'kafkajs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type KafkaClientConfig } from './kafka.config';
import { createKafkaClient } from './kafkajs-client.factory';
import { KafkaJsEventPublisher } from './kafkajs-event.publisher';

vi.mock('./kafkajs-client.factory', () => ({
  createKafkaClient: vi.fn(),
}));

const CONFIG: KafkaClientConfig = {
  brokers: ['localhost:9092'],
  clientId: 'anti-fraud-publisher-test',
  connectionTimeoutMs: 3000,
  requestTimeoutMs: 30000,
  retryInitialTimeMs: 300,
  retryCount: 5,
};

function transactionStatusUpdatedEvent(): TransactionStatusUpdatedV1 {
  const transactionExternalId = randomUUID();
  return {
    eventId: randomUUID(),
    eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
    version: 1 as const,
    correlationId: transactionExternalId,
    causationId: randomUUID(),
    data: { transactionExternalId, status: 'approved' as const },
  };
}

function buildSubject(connect: Producer['connect']) {
  const producer = {
    connect,
    send: vi.fn().mockResolvedValue([
      {
        topicName: TRANSACTION_STATUS_UPDATED_TOPIC,
        partition: 0,
        errorCode: 0,
        baseOffset: '1',
        logAppendTime: '-1',
        logStartOffset: '0',
      },
    ]),
    disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as Producer;
  const kafka = { producer: vi.fn().mockReturnValue(producer) } as unknown as Kafka;
  vi.mocked(createKafkaClient).mockReturnValue(kafka);
  return { subject: new KafkaJsEventPublisher(CONFIG), producer };
}

describe('KafkaJsEventPublisher lifecycle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('connects lazily on the first publication', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const context = buildSubject(connect);
    expect(connect).not.toHaveBeenCalled();
    await context.subject.publish(transactionStatusUpdatedEvent());
    expect(connect).toHaveBeenCalledOnce();
    expect(context.producer.send).toHaveBeenCalledOnce();
    await context.subject.onModuleDestroy();
  });

  it('can connect again after an unavailable broker', async () => {
    const connect = vi
      .fn()
      .mockRejectedValueOnce(new Error('unavailable'))
      .mockResolvedValueOnce(undefined);
    const context = buildSubject(connect);
    await expect(context.subject.publish(transactionStatusUpdatedEvent())).rejects.toThrow(
      'unavailable',
    );
    await expect(context.subject.publish(transactionStatusUpdatedEvent())).resolves.toBeUndefined();
    expect(connect).toHaveBeenCalledTimes(2);
    await context.subject.onModuleDestroy();
  });
});
