import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_CREATED_TOPIC,
  type FailedKafkaMessageV1,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';
import { describe, expect, it, vi } from 'vitest';

import { type DeadLetterPublisher } from '../../../application/ports/dead-letter-publisher.port';
import { type TransactionStatusPublisher } from '../../../application/ports/transaction-status-publisher.port';
import { AnalyzeTransactionUseCase } from '../../../application/use-cases/analyze-transaction.use-case';
import { AntiFraudPolicy } from '../../../domain/anti-fraud/anti-fraud-policy';
import { type KafkaRecord } from '../shared/kafka-record';

import { TransactionCreatedMessageProcessor } from './transaction-created-message.processor';

const TRANSACTION_ID = '0199f9c2-1a2b-7c8d-9e0f-1234567890ab';
const EVENT_ID = '0199f9c3-4a2b-7c8d-9e0f-1234567890ab';

function validRecord(): KafkaRecord {
  return {
    topic: TRANSACTION_CREATED_TOPIC,
    partition: 1,
    offset: '42',
    key: TRANSACTION_ID,
    value: JSON.stringify({
      eventId: EVENT_ID,
      eventName: TRANSACTION_CREATED_TOPIC,
      version: INTEGRATION_EVENT_VERSION,
      correlationId: TRANSACTION_ID,
      causationId: null,
      data: { transactionExternalId: TRANSACTION_ID, value: 1000 },
    }),
  };
}

function createProcessor(input?: {
  publishStatus?: TransactionStatusPublisher['publish'];
  publishDeadLetter?: DeadLetterPublisher['publishDeadLetter'];
}) {
  const publishStatus =
    input?.publishStatus ?? vi.fn<(event: TransactionStatusUpdatedV1) => Promise<void>>();
  const publishDeadLetter =
    input?.publishDeadLetter ?? vi.fn<(message: FailedKafkaMessageV1) => Promise<void>>();
  const analyzeTransaction = new AnalyzeTransactionUseCase(new AntiFraudPolicy(), {
    publish: publishStatus,
  });
  const processor = new TransactionCreatedMessageProcessor(
    { analyzeTransaction, deadLetterPublisher: { publishDeadLetter } },
    { maxAttempts: 3, retryDelayMs: 1, now: () => new Date(0), delay: vi.fn() },
  );
  return { processor, publishStatus, publishDeadLetter };
}

describe('TransactionCreatedMessageProcessor', () => {
  it('retries transient publication failures with heartbeat before sending to DLQ', async () => {
    const publishStatus = vi
      .fn<(event: TransactionStatusUpdatedV1) => Promise<void>>()
      .mockRejectedValue(new Error('temporary failure'));
    const context = createProcessor({ publishStatus });
    const heartbeat = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await context.processor.process(validRecord(), heartbeat);
    expect(publishStatus).toHaveBeenCalledTimes(3);
    expect(heartbeat).toHaveBeenCalledTimes(4);
    expect(context.publishDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({ attempts: 3, originalValue: validRecord().value }),
    );
  });

  it('sends an invalid event directly to DLQ with recoverable source context', async () => {
    const context = createProcessor();
    const record = { ...validRecord(), value: '{invalid-json' };
    await context.processor.process(record, vi.fn());
    expect(context.publishStatus).not.toHaveBeenCalled();
    expect(context.publishDeadLetter).toHaveBeenCalledWith({
      version: 1,
      sourceTopic: TRANSACTION_CREATED_TOPIC,
      partition: 1,
      offset: '42',
      originalKey: TRANSACTION_ID,
      originalValue: '{invalid-json',
      attempts: 1,
      failedAt: new Date(0).toISOString(),
      error: { code: 'INVALID_EVENT', message: 'Kafka event is not valid JSON' },
    });
  });

  it('propagates a DLQ publication failure so the offset cannot be committed', async () => {
    const publishDeadLetter = vi.fn().mockRejectedValue(new Error('DLQ unavailable'));
    const context = createProcessor({ publishDeadLetter });
    await expect(
      context.processor.process({ ...validRecord(), value: null }, vi.fn()),
    ).rejects.toThrow('DLQ unavailable');
  });
});
