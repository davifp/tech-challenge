import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { InvalidTransactionError } from '../errors/invalid-transaction.error';

import { Transaction } from './transaction';
import { TRANSFER_TYPE_ID } from './transaction-type';

describe('Transaction invariants', () => {
  it('rejects the same account even when UUID casing differs', () => {
    const sameAccount = randomUUID();
    expect(() =>
      Transaction.createPending({
        accountExternalIdDebit: sameAccount.toLowerCase(),
        accountExternalIdCredit: sameAccount.toUpperCase(),
        value: 120,
        transferTypeId: TRANSFER_TYPE_ID,
      }),
    ).toThrow(InvalidTransactionError);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 120.005])('rejects invalid value %s', (value) => {
    expect(() =>
      Transaction.createPending({
        accountExternalIdDebit: randomUUID(),
        accountExternalIdCredit: randomUUID(),
        value,
        transferTypeId: TRANSFER_TYPE_ID,
      }),
    ).toThrow(InvalidTransactionError);
  });
});
