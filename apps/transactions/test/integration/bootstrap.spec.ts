import { describe, expect, it } from 'vitest';

import { validateEnv } from '../../src/infrastructure/config/env.validator';

const VALID_URL = 'postgresql://postgres:postgres@localhost:5432/challenge?schema=public';
const VALID_KAFKA_ENV = {
  KAFKA_BROKERS: 'localhost:9092',
  KAFKA_CLIENT_ID: 'transactions-test',
  KAFKA_GROUP_ID_TRANSACTIONS: 'transactions-test-consumer',
};

describe('bootstrap env validation', () => {
  it('fails when DATABASE_URL is missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development', ...VALID_KAFKA_ENV })).toThrowError(
      /DATABASE_URL/,
    );
  });

  it('fails when DATABASE_URL is not a Postgres URL', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'https://example.com',
        ...VALID_KAFKA_ENV,
      }),
    ).toThrowError(/DATABASE_URL/);
  });

  it('requires DATABASE_URL_TEST when NODE_ENV=test', () => {
    expect(() =>
      validateEnv({ NODE_ENV: 'test', DATABASE_URL: VALID_URL, ...VALID_KAFKA_ENV }),
    ).toThrowError(/DATABASE_URL_TEST/);
  });

  it('returns typed env when all required variables are present', () => {
    const env = validateEnv({
      NODE_ENV: 'development',
      DATABASE_URL: VALID_URL,
      TRANSACTIONS_PORT: '3001',
      ...VALID_KAFKA_ENV,
    });
    expect(env.DATABASE_URL).toBe(VALID_URL);
    expect(env.TRANSACTIONS_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
    expect(env.KAFKA_BROKERS).toEqual(['localhost:9092']);
  });

  it('fails when Kafka brokers are missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development', DATABASE_URL: VALID_URL })).toThrowError(
      /KAFKA_BROKERS/,
    );
  });

  it('fails when Kafka brokers contain no usable address', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: VALID_URL,
        ...VALID_KAFKA_ENV,
        KAFKA_BROKERS: ' , ',
      }),
    ).toThrowError(/KAFKA_BROKERS/);
  });

  it('fails when outbox configuration is invalid', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: VALID_URL,
        OUTBOX_BATCH_SIZE: '0',
        ...VALID_KAFKA_ENV,
      }),
    ).toThrowError(/OUTBOX_BATCH_SIZE/);
  });
});
