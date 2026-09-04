import { describe, expect, it } from 'vitest';

import { IDEMPOTENCY_KEY_MAX_LENGTH, idempotencyKeySchema } from './idempotency-key.decorator';

describe('idempotencyKeySchema', () => {
  it('accepts undefined (header is optional)', () => {
    expect(idempotencyKeySchema.safeParse(undefined).success).toBe(true);
  });

  it('accepts a UUID within the limit', () => {
    expect(idempotencyKeySchema.safeParse('5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f').success).toBe(
      true,
    );
  });

  it(`rejects strings longer than ${IDEMPOTENCY_KEY_MAX_LENGTH} chars`, () => {
    const tooLong = 'a'.repeat(IDEMPOTENCY_KEY_MAX_LENGTH + 1);
    expect(idempotencyKeySchema.safeParse(tooLong).success).toBe(false);
  });

  it('rejects non-string values', () => {
    expect(idempotencyKeySchema.safeParse(123).success).toBe(false);
    expect(idempotencyKeySchema.safeParse({}).success).toBe(false);
  });
});
