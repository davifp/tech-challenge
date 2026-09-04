import { Transaction } from '../../domain/transaction/transaction';
import { IdempotencyKeyConflictError } from '../errors/idempotency-key-conflict.error';
import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';
import { hashBody } from '../helpers/hash-body';
import {
  type TransactionCatalogRepository,
  type TransferTypeCatalogEntry,
} from '../ports/transaction-catalog-repository.port';
import { type TransactionRepository } from '../ports/transaction-repository.port';

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
    if (command.idempotencyKey) {
      const replay = await this.tryReplay(command.idempotencyKey, command);
      if (replay) return replay;
    }
    const transferType = await this.resolveTransferType(command.transferTypeId);
    const transaction = Transaction.createPending({
      accountExternalIdDebit: command.accountExternalIdDebit,
      accountExternalIdCredit: command.accountExternalIdCredit,
      value: command.value,
      transferTypeId: transferType.id,
    });
    const saved = await this.transactionRepository.save(transaction, command.idempotencyKey);
    return { transaction: saved, wasReplayed: false };
  }

  private async tryReplay(
    idempotencyKey: string,
    command: CreateTransactionCommand,
  ): Promise<CreateTransactionResult | null> {
    const existing = await this.transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (!existing) return null;
    const existingHash = hashBody(existing);
    const newHash = hashBody(command);
    if (existingHash !== newHash) {
      throw new IdempotencyKeyConflictError(idempotencyKey);
    }
    return { transaction: existing, wasReplayed: true };
  }

  private async resolveTransferType(transferTypeId: number): Promise<TransferTypeCatalogEntry> {
    const transferType = await this.catalogRepository.findTransferTypeById(transferTypeId);
    if (!transferType) throw new TransferTypeNotFoundError(transferTypeId);
    return transferType;
  }
}
