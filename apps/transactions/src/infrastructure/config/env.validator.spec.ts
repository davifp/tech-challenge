import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validator';

const validEnvironment = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/challenge',
  KAFKA_BROKERS: 'localhost:9092,localhost:9093',
  KAFKA_CLIENT_ID: 'transactions',
  KAFKA_GROUP_ID_TRANSACTIONS: 'transactions-consumer',
};

describe('transactions environment validation', () => {
  it('loads validated consumer defaults and parses brokers', () => {
    const env = validateEnv(validEnvironment);
    expect(env.KAFKA_BROKERS).toEqual(['localhost:9092', 'localhost:9093']);
    expect(env.KAFKA_SESSION_TIMEOUT_MS).toBe(30000);
    expect(env.KAFKA_CONSUMER_MAX_ATTEMPTS).toBe(3);
    expect(env.KAFKA_CONSUMER_RETRY_DELAY_MS).toBe(300);
  });

  it('rejects more attempts than the bounded retry policy supports', () => {
    expect(() => validateEnv({ ...validEnvironment, KAFKA_CONSUMER_MAX_ATTEMPTS: '4' })).toThrow(
      'KAFKA_CONSUMER_MAX_ATTEMPTS',
    );
  });

  it('rejects a retry delay that cannot heartbeat within the session', () => {
    expect(() =>
      validateEnv({
        ...validEnvironment,
        KAFKA_SESSION_TIMEOUT_MS: '300',
        KAFKA_CONSUMER_RETRY_DELAY_MS: '300',
      }),
    ).toThrow('KAFKA_CONSUMER_RETRY_DELAY_MS');
  });
});
