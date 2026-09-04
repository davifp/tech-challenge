import { randomUUID } from 'node:crypto';

import { vi } from 'vitest';

import { type Transaction } from '../../domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../domain/transaction/transaction-type';
import { type TransactionCatalogRepository } from '../ports/transaction-catalog-repository.port';
import { type TransactionRepository } from '../ports/transaction-repository.port';

import { type CreateTransactionCommand } from './create-transaction.use-case';

export function buildCommand(
  overrides: Partial<CreateTransactionCommand> = {},
): CreateTransactionCommand {
  return {
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120,
    transferTypeId: TRANSFER_TYPE_ID,
    ...overrides,
  };
}

export function buildRepositories(): {
  transactionRepository: TransactionRepository;
  catalogRepository: TransactionCatalogRepository;
} {
  return {
    transactionRepository: {
      save: vi.fn(async (transaction: Transaction) => transaction),
      findByExternalId: vi.fn(),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
    },
    catalogRepository: {
      findTransferTypeById: vi.fn().mockResolvedValue({ id: TRANSFER_TYPE_ID, name: 'transfer' }),
    },
  };
}
