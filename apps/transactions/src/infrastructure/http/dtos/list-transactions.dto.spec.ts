import { describe, expect, it } from 'vitest';

import { listTransactionsSchema } from './list-transactions.dto';

describe('listTransactionsSchema', () => {
  it('applies defaults when nothing is passed', () => {
    const result = listTransactionsSchema.parse({});
    expect(result).toMatchObject({ page: 1, limit: 20 });
  });

  it('rejects page < 1', () => {
    expect(listTransactionsSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(listTransactionsSchema.safeParse({ page: -1 }).success).toBe(false);
  });

  it('rejects limit > 100', () => {
    expect(listTransactionsSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('rejects limit < 1', () => {
    expect(listTransactionsSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('rejects date-only createdAtFrom (no timezone)', () => {
    expect(listTransactionsSchema.safeParse({ createdAtFrom: '2026-09-04' }).success).toBe(false);
  });

  it('rejects malformed createdAtTo', () => {
    expect(listTransactionsSchema.safeParse({ createdAtTo: 'not-a-date' }).success).toBe(false);
  });

  it('accepts RFC 3339 with Z offset', () => {
    const result = listTransactionsSchema.parse({
      createdAtFrom: '2026-09-04T00:00:00Z',
      createdAtTo: '2026-09-05T00:00:00Z',
    });
    expect(result.createdAtFrom).toBe('2026-09-04T00:00:00Z');
  });

  it('rejects when createdAtTo < createdAtFrom', () => {
    const result = listTransactionsSchema.safeParse({
      createdAtFrom: '2026-09-05T00:00:00Z',
      createdAtTo: '2026-09-04T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(listTransactionsSchema.safeParse({ status: 'unknown' }).success).toBe(false);
  });
});
