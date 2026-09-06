import { describe, expect, it, vi } from 'vitest';

import { buildCommand, buildRepositories } from '../../../test/helpers/create-transaction.fixtures';
import { PENDING_STATUS_ID } from '../../domain/transaction/transaction-status';
import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';

import { CreateTransactionUseCase } from './create-transaction.use-case';

describe('CreateTransactionUseCase (create flow)', () => {
  it('saves with pending status and returns the complete transaction', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    const command = buildCommand();
    const { transaction, wasReplayed } = await useCase.execute(command);
    expect(wasReplayed).toBe(false);
    expect(transaction.transactionStatusId).toBe(PENDING_STATUS_ID);
    expect(transaction.accountExternalIdDebit).toBe(command.accountExternalIdDebit);
    expect(transaction.accountExternalIdCredit).toBe(command.accountExternalIdCredit);
    expect(transaction.value).toBe(command.value);
    expect(transaction.transferTypeId).toBe(command.transferTypeId);
    expect(transactionEventStore.savePending).toHaveBeenCalledWith({
      transaction,
      event: expect.objectContaining({
        eventName: 'transaction.created',
        correlationId: transaction.transactionExternalId,
        causationId: null,
        data: {
          transactionExternalId: transaction.transactionExternalId,
          value: transaction.value,
        },
      }),
      idempotency: undefined,
    });
  });

  it('throws TransferTypeNotFoundError when the catalog does not know the type', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    vi.mocked(catalogRepository.findTransferTypeById).mockResolvedValue(null);
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    await expect(useCase.execute(buildCommand({ transferTypeId: 99 }))).rejects.toBeInstanceOf(
      TransferTypeNotFoundError,
    );
    expect(transactionEventStore.savePending).not.toHaveBeenCalled();
  });
});
