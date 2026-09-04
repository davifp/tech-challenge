import { describe, expect, it, vi } from 'vitest';

import { Transaction } from '../../domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../domain/transaction/transaction-type';
import { IdempotencyKeyConflictError } from '../errors/idempotency-key-conflict.error';

import { buildCommand, buildRepositories } from './create-transaction.fixtures';
import { CreateTransactionUseCase } from './create-transaction.use-case';

describe('CreateTransactionUseCase (idempotency)', () => {
  it('replays the existing transaction on Idempotency-Key hit with same body', async () => {
    const { transactionRepository, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-1' });
    const existing = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: command.value,
      transferTypeId: TRANSFER_TYPE_ID,
    });
    vi.mocked(transactionRepository.findByIdempotencyKey).mockResolvedValue(existing);
    const useCase = new CreateTransactionUseCase(transactionRepository, catalogRepository);
    const { transaction, wasReplayed } = await useCase.execute(command);
    expect(wasReplayed).toBe(true);
    expect(transaction).toBe(existing);
    expect(transactionRepository.save).not.toHaveBeenCalled();
    expect(catalogRepository.findTransferTypeById).not.toHaveBeenCalled();
  });

  it('throws IdempotencyKeyConflictError on Idempotency-Key hit with different body', async () => {
    const { transactionRepository, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-1' });
    const existing = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: 999,
      transferTypeId: TRANSFER_TYPE_ID,
    });
    vi.mocked(transactionRepository.findByIdempotencyKey).mockResolvedValue(existing);
    const useCase = new CreateTransactionUseCase(transactionRepository, catalogRepository);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });
});
