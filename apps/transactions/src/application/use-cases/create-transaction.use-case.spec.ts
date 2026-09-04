import { describe, expect, it, vi } from 'vitest';

import { PENDING_STATUS_ID } from '../../domain/transaction/transaction-status';
import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';

import { buildCommand, buildRepositories } from './create-transaction.fixtures';
import { CreateTransactionUseCase } from './create-transaction.use-case';

describe('CreateTransactionUseCase (create flow)', () => {
  it('saves with pending status and returns the complete transaction', async () => {
    const { transactionRepository, catalogRepository } = buildRepositories();
    const useCase = new CreateTransactionUseCase(transactionRepository, catalogRepository);
    const command = buildCommand();
    const { transaction, wasReplayed } = await useCase.execute(command);
    expect(wasReplayed).toBe(false);
    expect(transaction.transactionStatusId).toBe(PENDING_STATUS_ID);
    expect(transaction.accountExternalIdDebit).toBe(command.accountExternalIdDebit);
    expect(transaction.accountExternalIdCredit).toBe(command.accountExternalIdCredit);
    expect(transaction.value).toBe(command.value);
    expect(transaction.transferTypeId).toBe(command.transferTypeId);
    expect(transactionRepository.save).toHaveBeenCalledTimes(1);
  });

  it('throws TransferTypeNotFoundError when the catalog does not know the type', async () => {
    const { transactionRepository, catalogRepository } = buildRepositories();
    vi.mocked(catalogRepository.findTransferTypeById).mockResolvedValue(null);
    const useCase = new CreateTransactionUseCase(transactionRepository, catalogRepository);
    await expect(useCase.execute(buildCommand({ transferTypeId: 99 }))).rejects.toBeInstanceOf(
      TransferTypeNotFoundError,
    );
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});
