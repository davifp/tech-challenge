import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { InvalidTransactionError } from '../errors/invalid-transaction.error';

import { Transaction, type CreatePendingTransactionInput } from './transaction';
import { PENDING_STATUS_ID } from './transaction-status';
import { TRANSFER_TYPE_ID } from './transaction-type';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildInput(
  overrides: Partial<CreatePendingTransactionInput> = {},
): CreatePendingTransactionInput {
  return {
    accountExternalIdDebit: randomUUID(),
    accountExternalIdCredit: randomUUID(),
    value: 120.5,
    transferTypeId: TRANSFER_TYPE_ID,
    ...overrides,
  };
}

describe('Transaction.createPending', () => {
  it('creates a pending transaction with a UUID v7 identifier', () => {
    const input = buildInput();
    const transaction = Transaction.createPending(input);
    expect(transaction.transactionExternalId).toMatch(UUID_V7_PATTERN);
    expect(transaction.transactionStatusId).toBe(PENDING_STATUS_ID);
    expect(transaction.value).toBe(input.value);
    expect(transaction.accountExternalIdDebit).toBe(input.accountExternalIdDebit);
    expect(transaction.accountExternalIdCredit).toBe(input.accountExternalIdCredit);
    expect(transaction.transferTypeId).toBe(input.transferTypeId);
    expect(transaction.createdAt).toEqual(transaction.updatedAt);
  });

  it('rejects zero value', () => {
    expect(() => Transaction.createPending(buildInput({ value: 0 }))).toThrow(
      InvalidTransactionError,
    );
  });

  it('rejects negative value', () => {
    expect(() => Transaction.createPending(buildInput({ value: -10 }))).toThrow(
      InvalidTransactionError,
    );
  });

  it('rejects when debit and credit accounts are equal', () => {
    const sameAccount = randomUUID();
    expect(() =>
      Transaction.createPending(
        buildInput({ accountExternalIdDebit: sameAccount, accountExternalIdCredit: sameAccount }),
      ),
    ).toThrow(InvalidTransactionError);
  });
});
