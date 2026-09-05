import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { Transaction } from '../../../domain/transaction/transaction';
import { TRANSFER_TYPE_ID } from '../../../domain/transaction/transaction-type';

import { toTransactionResponse } from './transaction-response.mapper';

describe('toTransactionResponse', () => {
  it('produces the exact TransactionResponse shape', () => {
    const transaction = Transaction.createPending({
      accountExternalIdDebit: randomUUID(),
      accountExternalIdCredit: randomUUID(),
      value: 120.5,
      transferTypeId: TRANSFER_TYPE_ID,
    });
    const response = toTransactionResponse(transaction);
    expect(Object.keys(response).sort()).toEqual(
      [
        'accountExternalIdCredit',
        'accountExternalIdDebit',
        'createdAt',
        'transactionExternalId',
        'transactionStatus',
        'transactionType',
        'updatedAt',
        'value',
      ].sort(),
    );
    expect(response.transactionType).toEqual({ name: 'transfer' });
    expect(response.transactionStatus).toEqual({ name: 'pending' });
    expect(response.accountExternalIdDebit).toBe(transaction.accountExternalIdDebit);
    expect(response.accountExternalIdCredit).toBe(transaction.accountExternalIdCredit);
    expect(response.value).toBe(120.5);
    expect(response.createdAt).toBe(transaction.createdAt.toISOString());
    expect(response.updatedAt).toBe(transaction.updatedAt.toISOString());
  });

  it('serializes value with two decimals', () => {
    const transaction = Transaction.createPending({
      accountExternalIdDebit: randomUUID(),
      accountExternalIdCredit: randomUUID(),
      value: 120,
      transferTypeId: TRANSFER_TYPE_ID,
    });
    const response = toTransactionResponse(transaction);
    expect(response.value).toBe(120);
  });
});
