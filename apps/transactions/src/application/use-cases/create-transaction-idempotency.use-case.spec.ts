import { describe, expect, it, vi } from 'vitest';

import { buildCommand, buildRepositories } from '../../../test/helpers/create-transaction.fixtures';
import { Transaction } from '../../domain/transaction/transaction';
import { PIX_TYPE_ID } from '../../domain/transaction/transaction-type';
import { IdempotencyKeyConflictError } from '../errors/idempotency-key-conflict.error';
import { hashBody } from '../helpers/hash-body';

import { CreateTransactionUseCase } from './create-transaction.use-case';

describe('CreateTransactionUseCase (idempotency)', () => {
  it('replays the existing transaction on Idempotency-Key hit with same body', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-1' });
    const existing = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: command.value,
      transferTypeId: PIX_TYPE_ID,
    });
    vi.mocked(transactionEventStore.findByIdempotencyKey).mockResolvedValue({
      transaction: existing,
      bodyHash: hashBody(command),
    });
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    const { transaction, wasReplayed } = await useCase.execute(command);
    expect(wasReplayed).toBe(true);
    expect(transaction).toBe(existing);
    expect(transactionEventStore.savePending).not.toHaveBeenCalled();
    expect(catalogRepository.findTransferTypeById).not.toHaveBeenCalled();
  });

  it('throws IdempotencyKeyConflictError on Idempotency-Key hit with different body', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-1' });
    const existing = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: 999,
      transferTypeId: PIX_TYPE_ID,
    });
    vi.mocked(transactionEventStore.findByIdempotencyKey).mockResolvedValue({
      transaction: existing,
      bodyHash: hashBody(existing),
    });
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
    expect(transactionEventStore.savePending).not.toHaveBeenCalled();
  });

  it('replays a transaction recovered by save after a concurrent insert', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-race' });
    const winner = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: command.value,
      transferTypeId: PIX_TYPE_ID,
    });
    vi.mocked(transactionEventStore.savePending).mockResolvedValue({
      outcome: 'replayed',
      transaction: winner,
      bodyHash: hashBody(command),
    });
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    await expect(useCase.execute(command)).resolves.toMatchObject({
      transaction: winner,
      wasReplayed: true,
    });
  });

  it('rejects a different body recovered by save after a concurrent insert', async () => {
    const { transactionEventStore, catalogRepository } = buildRepositories();
    const command = buildCommand({ idempotencyKey: 'idem-race' });
    const winner = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: 999,
      transferTypeId: PIX_TYPE_ID,
    });
    vi.mocked(transactionEventStore.savePending).mockResolvedValue({
      outcome: 'replayed',
      transaction: winner,
      bodyHash: hashBody(winner),
    });
    const useCase = new CreateTransactionUseCase(transactionEventStore, catalogRepository);
    await expect(useCase.execute(command)).rejects.toBeInstanceOf(IdempotencyKeyConflictError);
  });
});
