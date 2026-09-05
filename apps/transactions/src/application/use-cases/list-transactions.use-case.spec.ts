import { describe, expect, it, vi } from 'vitest';

import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';
import { type TransactionCatalogRepository } from '../ports/transaction-catalog-repository.port';
import {
  type ListTransactionsResult,
  type TransactionRepository,
} from '../ports/transaction-repository.port';

import { ListTransactionsUseCase } from './list-transactions.use-case';

const EMPTY_RESULT: ListTransactionsResult = { items: [], total: 0 };

function buildRepository(result: ListTransactionsResult = EMPTY_RESULT): TransactionRepository {
  return {
    findByExternalId: vi.fn(),
    list: vi.fn().mockResolvedValue(result),
  };
}

function buildCatalog(): TransactionCatalogRepository {
  return { findTransferTypeById: vi.fn().mockResolvedValue({ id: 1, name: 'transfer' }) };
}

describe('ListTransactionsUseCase', () => {
  it('applies defaults (page=1, limit=20) and forwards to repository', async () => {
    const repository = buildRepository();
    const useCase = new ListTransactionsUseCase(repository, buildCatalog());
    const result = await useCase.execute();
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 20 }));
    expect(result).toMatchObject({ page: 1, limit: 20, total: 0 });
  });

  it('preserves filters and returns page/limit/total in the envelope', async () => {
    const repository = buildRepository({ items: [], total: 42 });
    const useCase = new ListTransactionsUseCase(repository, buildCatalog());
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
    const useCase = new ListTransactionsUseCase(repository, buildCatalog());
    await useCase.execute({ page: 0, limit: 500 });
    expect(repository.list).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 100 }));
  });

  it('rejects a transfer type that does not exist in the catalog', async () => {
    const repository = buildRepository();
    const catalog = buildCatalog();
    vi.mocked(catalog.findTransferTypeById).mockResolvedValue(null);
    const useCase = new ListTransactionsUseCase(repository, catalog);
    await expect(useCase.execute({ transferTypeId: 999 })).rejects.toBeInstanceOf(
      TransferTypeNotFoundError,
    );
    expect(repository.list).not.toHaveBeenCalled();
  });
});
