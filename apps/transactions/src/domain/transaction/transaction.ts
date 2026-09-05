import { v7 as uuidv7 } from 'uuid';

import { InvalidTransactionError } from '../errors/invalid-transaction.error';

import { normalizeAccountExternalId } from './normalize-account-external-id';
import { PENDING_STATUS_ID, type TransactionStatusId } from './transaction-status';
import { type TransactionTypeId } from './transaction-type';

const MIN_VALUE = 0;
const DECIMAL_SCALE = 2;

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

type InvariantFields = Pick<
  TransactionProps,
  'accountExternalIdDebit' | 'accountExternalIdCredit' | 'value'
>;

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
    const normalizedInput = Transaction.normalizeAccounts(input);
    Transaction.assertInvariants(normalizedInput);
    const now = new Date();
    const props = {
      transactionExternalId: uuidv7(),
      ...normalizedInput,
      transactionStatusId: PENDING_STATUS_ID,
      createdAt: now,
      updatedAt: now,
    } satisfies TransactionProps;
    return new Transaction(props);
  }

  static reconstitute(props: TransactionProps): Transaction {
    const normalizedProps = Transaction.normalizeAccounts(props);
    Transaction.assertInvariants(normalizedProps);
    return new Transaction(normalizedProps);
  }

  private static assertInvariants(fields: InvariantFields): void {
    if (!Number.isFinite(fields.value) || fields.value <= MIN_VALUE) {
      throw new InvalidTransactionError('value must be greater than 0');
    }
    if (fields.value !== Number(fields.value.toFixed(DECIMAL_SCALE))) {
      throw new InvalidTransactionError('value must have up to two decimals');
    }
    if (fields.accountExternalIdDebit === fields.accountExternalIdCredit) {
      throw new InvalidTransactionError(
        'accountExternalIdDebit must be different from accountExternalIdCredit',
      );
    }
  }

  private static normalizeAccounts<T extends InvariantFields>(fields: T): T {
    return {
      ...fields,
      accountExternalIdDebit: normalizeAccountExternalId(fields.accountExternalIdDebit),
      accountExternalIdCredit: normalizeAccountExternalId(fields.accountExternalIdCredit),
    };
  }
}
