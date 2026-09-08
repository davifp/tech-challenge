import { type ConfigService } from '@nestjs/config';

import { type Env } from '../../config/env.schema';

export type TransactionStatusConsumerConfig = {
  brokers: string[];
  clientId: string;
  groupId: string;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  retryInitialTimeMs: number;
  retryCount: number;
  sessionTimeoutMs: number;
  maxAttempts: number;
  retryDelayMs: number;
  enabled: boolean;
};

export function transactionStatusConsumerConfig(
  config: ConfigService<Env, true>,
): TransactionStatusConsumerConfig {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  return {
    brokers: config.get('KAFKA_BROKERS', { infer: true }),
    clientId: config.get('KAFKA_CLIENT_ID', { infer: true }),
    groupId: config.get('KAFKA_GROUP_ID_TRANSACTIONS', { infer: true }),
    connectionTimeoutMs: config.get('KAFKA_CONNECTION_TIMEOUT_MS', { infer: true }),
    requestTimeoutMs: config.get('KAFKA_REQUEST_TIMEOUT_MS', { infer: true }),
    retryInitialTimeMs: config.get('KAFKA_RETRY_INITIAL_TIME_MS', { infer: true }),
    retryCount: config.get('KAFKA_RETRY_COUNT', { infer: true }),
    sessionTimeoutMs: config.get('KAFKA_SESSION_TIMEOUT_MS', { infer: true }),
    maxAttempts: config.get('KAFKA_CONSUMER_MAX_ATTEMPTS', { infer: true }),
    retryDelayMs: config.get('KAFKA_CONSUMER_RETRY_DELAY_MS', { infer: true }),
    enabled: config.get('KAFKA_CONSUMER_ENABLED', { infer: true }) ?? nodeEnv !== 'test',
  };
}
