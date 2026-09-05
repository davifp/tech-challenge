import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validator';

const REQUIRED_ENV = {
  KAFKA_BROKERS: 'localhost:9092, kafka:29092',
  KAFKA_CLIENT_ID: 'anti-fraud-test',
  KAFKA_GROUP_ID_ANTI_FRAUD: 'anti-fraud-test-consumer',
};

describe('anti-fraud environment validation', () => {
  it('normalizes brokers and applies the bounded consumer retry defaults', () => {
    const result = validateEnv(REQUIRED_ENV);
    expect(result.KAFKA_BROKERS).toEqual(['localhost:9092', 'kafka:29092']);
    expect(result.KAFKA_CONSUMER_MAX_ATTEMPTS).toBe(3);
    expect(result.KAFKA_SESSION_TIMEOUT_MS).toBe(30000);
  });

  it('rejects missing Kafka configuration and more than three consumer attempts', () => {
    expect(() => validateEnv({})).toThrow('Invalid environment variables');
    expect(() => validateEnv({ ...REQUIRED_ENV, KAFKA_CONSUMER_MAX_ATTEMPTS: 4 })).toThrow(
      'Invalid environment variables',
    );
    expect(() =>
      validateEnv({
        ...REQUIRED_ENV,
        KAFKA_SESSION_TIMEOUT_MS: 100,
        KAFKA_CONSUMER_RETRY_DELAY_MS: 100,
      }),
    ).toThrow('must be shorter than KAFKA_SESSION_TIMEOUT_MS');
  });
});
