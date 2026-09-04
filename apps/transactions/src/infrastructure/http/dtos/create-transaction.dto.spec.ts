import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTransactionSchema } from './create-transaction.dto';

const VALID_DEBIT = '5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f';
const VALID_CREDIT = 'aa11bb22-cc33-4d44-8e55-ff66aa77bb88';

function baseBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    accountExternalIdDebit: VALID_DEBIT,
    accountExternalIdCredit: VALID_CREDIT,
    transferTypeId: 1,
    value: 120,
    ...overrides,
  };
}

describe('createTransactionSchema', () => {
  it('accepts a valid body', () => {
    expect(createTransactionSchema.safeParse(baseBody()).success).toBe(true);
  });

  it('accepts value with up to two decimals', () => {
    expect(createTransactionSchema.safeParse(baseBody({ value: 120.5 })).success).toBe(true);
    expect(createTransactionSchema.safeParse(baseBody({ value: 120.55 })).success).toBe(true);
  });

  it('rejects invalid UUID on debit or credit', () => {
    expect(
      createTransactionSchema.safeParse(baseBody({ accountExternalIdDebit: 'nope' })).success,
    ).toBe(false);
    expect(
      createTransactionSchema.safeParse(baseBody({ accountExternalIdCredit: 'nope' })).success,
    ).toBe(false);
  });

  it('rejects value <= 0', () => {
    expect(createTransactionSchema.safeParse(baseBody({ value: 0 })).success).toBe(false);
    expect(createTransactionSchema.safeParse(baseBody({ value: -1 })).success).toBe(false);
  });

  it('rejects value with more than two decimals', () => {
    expect(createTransactionSchema.safeParse(baseBody({ value: 120.005 })).success).toBe(false);
  });

  it('rejects when debit and credit are equal', () => {
    const same = randomUUID();
    const result = createTransactionSchema.safeParse(
      baseBody({ accountExternalIdDebit: same, accountExternalIdCredit: same }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    expect(createTransactionSchema.safeParse(baseBody({ extra: 'nope' })).success).toBe(false);
  });

  it('rejects transferTypeId < 1', () => {
    expect(createTransactionSchema.safeParse(baseBody({ transferTypeId: 0 })).success).toBe(false);
  });
});
