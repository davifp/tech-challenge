import { randomUUID } from 'node:crypto';

import { vi } from 'vitest';

import { type TransactionCatalogRepository } from '../../src/application/ports/transaction-catalog-repository.port';
import {
  type SaveTransactionResult,
  type TransactionEventStore,
} from '../../src/application/ports/transaction-event-store.port';
import { type CreateTransactionCommand } from '../../src/application/use-cases/create-transaction.use-case';
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
  transactionEventStore: TransactionEventStore;
  catalogRepository: TransactionCatalogRepository;
} {
  return {
    transactionEventStore: {
      savePending: vi.fn(async ({ transaction }): Promise<SaveTransactionResult> => ({
        outcome: 'created',
        transaction,
      })),
      findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    },
    catalogRepository: {
      findTransferTypeById: vi.fn().mockResolvedValue({ id: TRANSFER_TYPE_ID, name: 'transfer' }),
    },
  };
}
