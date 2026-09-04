import { type Transaction } from '../../../domain/transaction/transaction';
import {
  APPROVED_STATUS_ID,
  PENDING_STATUS_ID,
  REJECTED_STATUS_ID,
  type TransactionStatusId,
  type TransactionStatusName,
} from '../../../domain/transaction/transaction-status';
import {
  TRANSFER_TYPE_ID,
  type TransactionTypeId,
  type TransactionTypeName,
} from '../../../domain/transaction/transaction-type';

const DECIMAL_SCALE = 2;

const STATUS_NAME_BY_ID: Record<TransactionStatusId, TransactionStatusName> = {
  [PENDING_STATUS_ID]: 'pending',
  [APPROVED_STATUS_ID]: 'approved',
  [REJECTED_STATUS_ID]: 'rejected',
};

const TYPE_NAME_BY_ID: Record<TransactionTypeId, TransactionTypeName> = {
  [TRANSFER_TYPE_ID]: 'transfer',
};

export type TransactionResponse = {
  transactionExternalId: string;
  transactionType: { name: TransactionTypeName };
  transactionStatus: { name: TransactionStatusName };
  value: number;
  createdAt: string;
  updatedAt: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
};

export function toTransactionResponse(transaction: Transaction): TransactionResponse {
  return {
    transactionExternalId: transaction.transactionExternalId,
    transactionType: { name: TYPE_NAME_BY_ID[transaction.transferTypeId] },
    transactionStatus: { name: STATUS_NAME_BY_ID[transaction.transactionStatusId] },
    value: Number(transaction.value.toFixed(DECIMAL_SCALE)),
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
    accountExternalIdDebit: transaction.accountExternalIdDebit,
    accountExternalIdCredit: transaction.accountExternalIdCredit,
  };
}
