import { randomUUID } from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { Transaction } from '../../domain/transaction/transaction';
import { PIX_TYPE_ID } from '../../domain/transaction/transaction-type';
import { TransactionNotFoundError } from '../errors/transaction-not-found.error';
import { type TransactionRepository } from '../ports/transaction-repository.port';

import { GetTransactionByExternalIdUseCase } from './get-transaction-by-external-id.use-case';

function buildTransaction(): Transaction {
  return Transaction.createPending({
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120,
    transferTypeId: PIX_TYPE_ID,
  });
}

function buildRepository(): TransactionRepository {
  return {
    findByExternalId: vi.fn(),
    list: vi.fn(),
  };
}

describe('GetTransactionByExternalIdUseCase', () => {
  it('returns the transaction when it exists', async () => {
    const transaction = buildTransaction();
    const repository = buildRepository();
    vi.mocked(repository.findByExternalId).mockResolvedValue(transaction);
    const useCase = new GetTransactionByExternalIdUseCase(repository);
    const result = await useCase.execute(transaction.transactionExternalId);
    expect(result).toBe(transaction);
    expect(repository.findByExternalId).toHaveBeenCalledWith(transaction.transactionExternalId);
  });

  it('throws TransactionNotFoundError when repository returns null', async () => {
    const repository = buildRepository();
    vi.mocked(repository.findByExternalId).mockResolvedValue(null);
    const useCase = new GetTransactionByExternalIdUseCase(repository);
    await expect(useCase.execute('missing-id')).rejects.toBeInstanceOf(TransactionNotFoundError);
  });
});
