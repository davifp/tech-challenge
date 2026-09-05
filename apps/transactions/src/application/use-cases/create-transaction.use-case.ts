import { Transaction } from '../../domain/transaction/transaction';
import { IdempotencyKeyConflictError } from '../errors/idempotency-key-conflict.error';
import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';
import { hashBody } from '../helpers/hash-body';
import {
  type TransactionCatalogRepository,
  type TransferTypeCatalogEntry,
} from '../ports/transaction-catalog-repository.port';
import {
  type IdempotentTransaction,
  type TransactionIdempotency,
  type TransactionRepository,
} from '../ports/transaction-repository.port';

export type CreateTransactionCommand = {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  value: number;
  transferTypeId: number;
  idempotencyKey?: string;
};

export type CreateTransactionResult = {
  transaction: Transaction;
  wasReplayed: boolean;
};

export class CreateTransactionUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly catalogRepository: TransactionCatalogRepository,
  ) {}

  async execute(command: CreateTransactionCommand): Promise<CreateTransactionResult> {
    const idempotency = this.buildIdempotency(command);
    if (idempotency) {
      const replay = await this.tryReplay(idempotency);
      if (replay) return replay;
    }
    const transferType = await this.resolveTransferType(command.transferTypeId);
    const transaction = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: command.value,
      transferTypeId: transferType.id,
    });
    const saved = await this.transactionRepository.save(transaction, idempotency);
    if (saved.outcome === 'created') {
      return { transaction: saved.transaction, wasReplayed: false };
    }
    this.assertSameRequest(saved.bodyHash, idempotency);
    return { transaction: saved.transaction, wasReplayed: true };
  }

  private async tryReplay(
    idempotency: TransactionIdempotency,
  ): Promise<CreateTransactionResult | null> {
    const existing = await this.transactionRepository.findByIdempotencyKey(idempotency.key);
    if (!existing) return null;
    this.assertSameRequest(existing.bodyHash, idempotency);
    return { transaction: existing.transaction, wasReplayed: true };
  }

  private async resolveTransferType(transferTypeId: number): Promise<TransferTypeCatalogEntry> {
    const transferType = await this.catalogRepository.findTransferTypeById(transferTypeId);
    if (!transferType) throw new TransferTypeNotFoundError(transferTypeId);
    return transferType;
  }

  private buildIdempotency(command: CreateTransactionCommand): TransactionIdempotency | undefined {
    if (!command.idempotencyKey) return undefined;
    return { key: command.idempotencyKey, bodyHash: hashBody(command) };
  }

  private assertSameRequest(
    persistedBodyHash: IdempotentTransaction['bodyHash'],
    idempotency: TransactionIdempotency | undefined,
  ): void {
    if (!idempotency || persistedBodyHash === idempotency.bodyHash) return;
    throw new IdempotencyKeyConflictError(idempotency.key);
  }
}
