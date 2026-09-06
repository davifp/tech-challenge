import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { TransactionDecisionConflictError } from '../errors/transaction-decision-conflict.error';
import { TransactionNotFoundError } from '../errors/transaction-not-found.error';
import {
  type ApplyTransactionDecisionInput,
  type TransactionDecisionStore,
  type TransactionDecisionStoreOutcome,
} from '../ports/transaction-decision-store.port';

import { ApplyTransactionStatusUseCase } from './apply-transaction-status.use-case';

const input: ApplyTransactionDecisionInput = {
  eventId: randomUUID(),
  transactionExternalId: randomUUID(),
  status: 'approved',
};

function buildStore(outcome: TransactionDecisionStoreOutcome): TransactionDecisionStore {
  return { apply: vi.fn().mockResolvedValue(outcome) };
}

describe('ApplyTransactionStatusUseCase', () => {
  it.each(['applied', 'duplicate'] as const)('returns the %s result', async (outcome) => {
    const store = buildStore(outcome);
    const useCase = new ApplyTransactionStatusUseCase(store);
    await expect(useCase.execute(input)).resolves.toBe(outcome);
    expect(store.apply).toHaveBeenCalledWith(input);
  });

  it('maps a missing transaction to TransactionNotFoundError', async () => {
    const useCase = new ApplyTransactionStatusUseCase(buildStore('not-found'));
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TransactionNotFoundError);
  });

  it('maps an opposing final decision to TransactionDecisionConflictError', async () => {
    const useCase = new ApplyTransactionStatusUseCase(buildStore('conflict'));
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TransactionDecisionConflictError);
  });
});
