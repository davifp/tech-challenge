import { describe, expect, it, vi } from 'vitest';

import {
  type ListTransactionsResult,
  type TransactionRepository,
} from '../ports/transaction-repository.port';

import { ListTransactionsUseCase } from './list-transactions.use-case';

const EMPTY_RESULT: ListTransactionsResult = { items: [], total: 0 };

function buildRepository(result: ListTransactionsResult = EMPTY_RESULT): TransactionRepository {
  return {
    save: vi.fn(),
    findByExternalId: vi.fn(),
    findByIdempotencyKey: vi.fn(),
    list: vi.fn().mockResolvedValue(result),
  };
}

describe('ListTransactionsUseCase', () => {
  it('applies defaults (page=1, limit=20) and forwards to repository', async () => {
    const repository = buildRepository();
    const useCase = new ListTransactionsUseCase(repository);
    const result = await useCase.execute();
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    expect(result).toMatchObject({ page: 1, limit: 20, total: 0 });
  });

  it('preserves filters and returns page/limit/total in the envelope', async () => {
    const repository = buildRepository({ items: [], total: 42 });
    const useCase = new ListTransactionsUseCase(repository);
    const from = new Date('2026-08-01T00:00:00Z');
    const to = new Date('2026-09-01T00:00:00Z');
    const result = await useCase.execute({
      status: 'approved',
      transferTypeId: 1,
      createdAtFrom: from,
      createdAtTo: to,
      page: 3,
      limit: 5,
    });
    expect(repository.list).toHaveBeenCalledWith({
      status: 'approved',
      transferTypeId: 1,
      createdAtFrom: from,
      createdAtTo: to,
      page: 3,
      limit: 5,
    });
    expect(result).toMatchObject({ page: 3, limit: 5, total: 42 });
  });

  it('clamps page to at least 1 and limit to [1, 100]', async () => {
    const repository = buildRepository();
    const useCase = new ListTransactionsUseCase(repository);
    await useCase.execute({ page: 0, limit: 500 });
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 100 }));
  });
});
