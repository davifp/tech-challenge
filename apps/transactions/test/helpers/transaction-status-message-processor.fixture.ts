import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type FailedKafkaMessageV1,
} from '@tech-challenge/event-contracts';
import { vi } from 'vitest';

import { type DeadLetterPublisher } from '../../src/application/ports/dead-letter-publisher.port';
import {
  type TransactionDecisionStore,
  type TransactionDecisionStoreOutcome,
} from '../../src/application/ports/transaction-decision-store.port';
import { ApplyTransactionStatusUseCase } from '../../src/application/use-cases/apply-transaction-status.use-case';
import { type KafkaRecord } from '../../src/infrastructure/kafka/kafka-record';
import { TransactionStatusMessageProcessor } from '../../src/infrastructure/kafka/transaction-status-message.processor';

export const TRANSACTION_ID = '0199f9c2-1a2b-7c8d-9e0f-1234567890ab';
export const EVENT_ID = 'd9428888-122b-5e56-8e67-849d6e8fc5c1';

export function validStatusRecord(): KafkaRecord {
  return {
    topic: TRANSACTION_STATUS_UPDATED_TOPIC,
    partition: 1,
    offset: '42',
    key: TRANSACTION_ID,
    value: JSON.stringify({
      eventId: EVENT_ID,
      eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
      version: INTEGRATION_EVENT_VERSION,
      correlationId: TRANSACTION_ID,
      causationId: '0199f9c3-4a2b-7c8d-9e0f-1234567890ab',
      data: { transactionExternalId: TRANSACTION_ID, status: 'approved' },
    }),
  };
}

export function createProcessor(input?: {
  apply?: TransactionDecisionStore['apply'];
  publishDeadLetter?: DeadLetterPublisher['publishDeadLetter'];
}) {
  const apply =
    input?.apply ??
    vi.fn<() => Promise<TransactionDecisionStoreOutcome>>().mockResolvedValue('applied');
  const publishDeadLetter =
    input?.publishDeadLetter ?? vi.fn<(message: FailedKafkaMessageV1) => Promise<void>>();
  const processor = new TransactionStatusMessageProcessor(
    {
      applyTransactionStatus: new ApplyTransactionStatusUseCase({ apply }),
      deadLetterPublisher: { publishDeadLetter },
    },
    { maxAttempts: 3, retryDelayMs: 1, now: () => new Date(0), delay: vi.fn() },
  );
  return { processor, apply, publishDeadLetter };
}
