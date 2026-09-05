import { type IdempotentTransaction } from '../../../application/ports/transaction-repository.port';
import { Transaction } from '../../../domain/transaction/transaction';
import { type TransactionStatusId } from '../../../domain/transaction/transaction-status';
import { type TransactionTypeId } from '../../../domain/transaction/transaction-type';
import {
  type Prisma,
  type Transaction as TransactionRecord,
} from '../../../generated/prisma/client';

const DECIMAL_SCALE = 2;

export function toTransactionEntity(record: TransactionRecord): Transaction {
  return Transaction.reconstitute({
    transactionExternalId: record.transactionExternalId,
    accountExternalIdDebit: record.accountExternalIdDebit,
    accountExternalIdCredit: record.accountExternalIdCredit,
    value: Number(record.value.toFixed(DECIMAL_SCALE)),
    transferTypeId: record.transferTypeId as TransactionTypeId,
    transactionStatusId: record.transactionStatusId as TransactionStatusId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

export function toIdempotentTransaction(record: TransactionRecord): IdempotentTransaction {
  if (!record.bodyHash) {
    throw new Error('Persisted idempotent transaction must include bodyHash');
  }
  return { transaction: toTransactionEntity(record), bodyHash: record.bodyHash };
}

export type PersistenceExtras = {
  idempotencyKey?: string;
  bodyHash?: string;
};

export function toTransactionCreateInput(
  transaction: Transaction,
  extras: PersistenceExtras = {},
): Prisma.TransactionUncheckedCreateInput {
  return {
    transactionExternalId: transaction.transactionExternalId,
    accountExternalIdDebit: transaction.accountExternalIdDebit,
    accountExternalIdCredit: transaction.accountExternalIdCredit,
    value: transaction.value.toFixed(DECIMAL_SCALE),
    transferTypeId: transaction.transferTypeId,
    transactionStatusId: transaction.transactionStatusId,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    idempotencyKey: extras.idempotencyKey,
    bodyHash: extras.bodyHash,
  };
}
