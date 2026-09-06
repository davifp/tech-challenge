import { describe, expect, it, vi } from 'vitest';

import {
  createProcessor,
  EVENT_ID,
  TRANSACTION_ID,
  validStatusRecord,
} from '../../../test/helpers/transaction-status-message-processor.fixture';

describe('TransactionStatusMessageProcessor', () => {
  it('maps Kafka events to the use case and accepts repeated delivery', async () => {
    const apply = vi.fn().mockResolvedValueOnce('applied').mockResolvedValueOnce('duplicate');
    const context = createProcessor({ apply });
    await context.processor.process(validStatusRecord(), vi.fn());
    await context.processor.process(validStatusRecord(), vi.fn());
    expect(apply).toHaveBeenCalledTimes(2);
    expect(apply).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      transactionExternalId: TRANSACTION_ID,
      status: 'approved',
    });
    expect(context.publishDeadLetter).not.toHaveBeenCalled();
  });

  it('sends invalid input directly to DLQ with recoverable source data', async () => {
    const context = createProcessor();
    const record = { ...validStatusRecord(), value: '{invalid-json' };
    await context.processor.process(record, vi.fn());
    expect(context.apply).not.toHaveBeenCalled();
    expect(context.publishDeadLetter).toHaveBeenCalledWith({
      version: 1,
      sourceTopic: 'transaction.status.updated',
      partition: 1,
      offset: '42',
      originalKey: TRANSACTION_ID,
      originalValue: '{invalid-json',
      attempts: 1,
      failedAt: new Date(0).toISOString(),
      error: { code: 'INVALID_EVENT', message: 'Kafka event is not valid JSON' },
    });
  });
});
