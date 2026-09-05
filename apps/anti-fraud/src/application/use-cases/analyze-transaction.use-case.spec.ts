import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_CREATED_TOPIC,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';
import { describe, expect, it, vi } from 'vitest';

import { AntiFraudPolicy } from '../../domain/anti-fraud/anti-fraud-policy';
import { type TransactionStatusPublisher } from '../ports/transaction-status-publisher.port';

import { AnalyzeTransactionUseCase } from './analyze-transaction.use-case';

const TRANSACTION_ID = '0199f9c2-1a2b-7c8d-9e0f-1234567890ab';
const CREATED_EVENT_ID = '0199f9c3-4a2b-7c8d-9e0f-1234567890ab';

function buildTransactionCreatedEvent(): TransactionCreatedV1 {
  return {
    eventId: CREATED_EVENT_ID,
    eventName: TRANSACTION_CREATED_TOPIC,
    version: INTEGRATION_EVENT_VERSION,
    correlationId: TRANSACTION_ID,
    causationId: null,
    data: { transactionExternalId: TRANSACTION_ID, value: 1000 },
  };
}

describe('AnalyzeTransactionUseCase', () => {
  it('publishes the same correlated decision when the creation event is reprocessed', async () => {
    const publisher: TransactionStatusPublisher = { publish: vi.fn().mockResolvedValue(undefined) };
    const useCase = new AnalyzeTransactionUseCase(new AntiFraudPolicy(), publisher);
    const event = buildTransactionCreatedEvent();
    const firstDecision = await useCase.execute(event);
    const repeatedDecision = await useCase.execute(event);
    expect(repeatedDecision).toEqual(firstDecision);
    expect(firstDecision).toMatchObject({
      eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
      correlationId: TRANSACTION_ID,
      causationId: CREATED_EVENT_ID,
      data: { transactionExternalId: TRANSACTION_ID, status: 'approved' },
    });
    expect(publisher.publish).toHaveBeenNthCalledWith(1, firstDecision);
    expect(publisher.publish).toHaveBeenNthCalledWith(2, firstDecision);
  });
});
