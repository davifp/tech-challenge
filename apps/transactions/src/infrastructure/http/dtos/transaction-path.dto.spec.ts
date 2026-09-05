import { describe, expect, it } from 'vitest';

import { transactionPathSchema } from './transaction-path.dto';

describe('transactionPathSchema', () => {
  it('accepts a UUID transaction identifier', () => {
    expect(
      transactionPathSchema.safeParse({
        transactionExternalId: '5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f',
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed transaction identifier', () => {
    expect(transactionPathSchema.safeParse({ transactionExternalId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });
});
