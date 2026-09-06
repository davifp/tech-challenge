import { describe, expect, it, vi } from 'vitest';

import {
  createProcessor,
  TRANSACTION_ID,
  validStatusRecord,
} from '../../../test/helpers/transaction-status-message-processor.fixture';
import { TransactionDecisionConflictError } from '../../application/errors/transaction-decision-conflict.error';
import { TransactionNotFoundError } from '../../application/errors/transaction-not-found.error';

describe('TransactionStatusMessageProcessor resilience', () => {
  it('retries a missing transaction with heartbeat before dead lettering', async () => {
    const apply = vi.fn().mockRejectedValue(new TransactionNotFoundError(TRANSACTION_ID));
    const context = createProcessor({ apply });
    const heartbeat = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    await context.processor.process(validStatusRecord(), heartbeat);
    expect(apply).toHaveBeenCalledTimes(3);
    expect(heartbeat).toHaveBeenCalledTimes(4);
    expect(context.publishDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 3,
        error: { code: 'TransactionNotFoundError', message: expect.any(String) },
      }),
    );
  });

  it('dead letters a conflicting final decision without retry', async () => {
    const conflict = new TransactionDecisionConflictError(TRANSACTION_ID, 'approved');
    const apply = vi.fn().mockRejectedValue(conflict);
    const context = createProcessor({ apply });
    const heartbeat = vi.fn<() => Promise<void>>();
    await context.processor.process(validStatusRecord(), heartbeat);
    expect(apply).toHaveBeenCalledOnce();
    expect(heartbeat).not.toHaveBeenCalled();
    expect(context.publishDeadLetter).toHaveBeenCalledWith(
      expect.objectContaining({
        attempts: 1,
        error: { code: conflict.code, message: conflict.message },
      }),
    );
  });

  it('propagates DLQ failure so the consumer cannot commit the offset', async () => {
    const publishDeadLetter = vi.fn().mockRejectedValue(new Error('DLQ unavailable'));
    const context = createProcessor({ publishDeadLetter });
    await expect(
      context.processor.process({ ...validStatusRecord(), value: null }, vi.fn()),
    ).rejects.toThrow('DLQ unavailable');
  });
});
