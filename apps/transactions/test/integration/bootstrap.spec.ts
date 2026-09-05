import { describe, expect, it } from 'vitest';

import { validateEnv } from '../../src/infrastructure/config/env.validator';

const VALID_URL = 'postgresql://postgres:postgres@localhost:5432/challenge?schema=public';

describe('bootstrap env validation', () => {
  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrowError(/DATABASE_URL/);
  });

  it('fails when DATABASE_URL is not a Postgres URL', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'development', DATABASE_URL: 'https://example.com' }),
    ).toThrowError(/DATABASE_URL/);
  });

  it('requires DATABASE_URL_TEST when NODE_ENV=test', () => {
    expect(() => validateEnv({ NODE_ENV: 'test', DATABASE_URL: VALID_URL })).toThrowError(
      /DATABASE_URL_TEST/,
    );
  });

  it('returns typed env when all required variables are present', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: VALID_URL,
      TRANSACTIONS_PORT: '3001',
    });
    expect(env.DATABASE_URL).toBe(VALID_URL);
    expect(env.TRANSACTIONS_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });
});
