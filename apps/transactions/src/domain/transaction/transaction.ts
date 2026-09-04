import { v7 as uuidv7 } from 'uuid';

import { InvalidTransactionError } from '../errors/invalid-transaction.error';

import { PENDING_STATUS_ID, type TransactionStatusId } from './transaction-status';
import { type TransactionTypeId } from './transaction-type';

const MIN_VALUE = 0;

export type CreatePendingTransactionInput = {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  value: number;
  transferTypeId: TransactionTypeId;
};

export type TransactionProps = {
  transactionExternalId: string;
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  value: number;
  transferTypeId: TransactionTypeId;
  transactionStatusId: TransactionStatusId;
  createdAt: Date;
  updatedAt: Date;
};

export class Transaction implements TransactionProps {
  readonly transactionExternalId!: string;
  readonly accountExternalIdDebit!: string;
  readonly accountExternalIdCredit!: string;
  readonly value!: number;
  readonly transferTypeId!: TransactionTypeId;
  readonly transactionStatusId!: TransactionStatusId;
  readonly createdAt!: Date;
  readonly updatedAt!: Date;

  private constructor(props: TransactionProps) {
    Object.assign(this, props);
  }

  static createPending(input: CreatePendingTransactionInput): Transaction {
    Transaction.assertInvariants(input);
    const now = new Date();
    const props = {
      transactionExternalId: uuidv7(),
      accountExternalIdDebit: input.accountExternalIdDebit,
      accountExternalIdCredit: input.accountExternalIdCredit,
      value: input.value,
      transferTypeId: input.transferTypeId,
      transactionStatusId: PENDING_STATUS_ID,
      createdAt: now,
      updatedAt: now,
    } satisfies TransactionProps;
    return new Transaction(props);
  }

  private static assertInvariants(input: CreatePendingTransactionInput): void {
    if (input.value <= MIN_VALUE) {
      throw new InvalidTransactionError('value must be greater than 0');
    }
    if (input.accountExternalIdDebit === input.accountExternalIdCredit) {
      throw new InvalidTransactionError(
        'accountExternalIdDebit must be different from accountExternalIdCredit',
      );
    }
  }
}
