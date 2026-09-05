import { randomUUID } from 'node:crypto';

import { vi } from 'vitest';

import { type TransactionCatalogRepository } from '../../src/application/ports/transaction-catalog-repository.port';
import {
  type SaveTransactionResult,
  type TransactionRepository,
} from '../../src/application/ports/transaction-repository.port';
import { type CreateTransactionCommand } from '../../src/application/use-cases/create-transaction.use-case';
import { type Transaction } from '../../src/domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../src/domain/transaction/transaction-type';

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
      save: vi.fn(async (transaction: Transaction): Promise<SaveTransactionResult> => ({
        outcome: 'created',
        transaction,
      })),
      findByExternalId: vi.fn(),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
      list: vi.fn(),
    },
    catalogRepository: {
      findTransferTypeById: vi.fn().mockResolvedValue({ id: TRANSFER_TYPE_ID, name: 'transfer' }),
    },
  };
}
