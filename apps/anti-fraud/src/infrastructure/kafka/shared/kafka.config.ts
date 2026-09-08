import { type ConfigService } from '@nestjs/config';

import { type Env } from '../../config/env.schema';

export type KafkaClientConfig = {
  brokers: string[];
  clientId: string;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  retryInitialTimeMs: number;
  retryCount: number;
};

export type TransactionCreatedConsumerConfig = KafkaClientConfig & {
  groupId: string;
  sessionTimeoutMs: number;
  maxAttempts: number;
  retryDelayMs: number;
};

export function kafkaClientConfig(config: ConfigService<Env, true>): KafkaClientConfig {
  return {
    brokers: config.get('KAFKA_BROKERS', { infer: true }),
    clientId: config.get('KAFKA_CLIENT_ID', { infer: true }),
    connectionTimeoutMs: config.get('KAFKA_CONNECTION_TIMEOUT_MS', { infer: true }),
    requestTimeoutMs: config.get('KAFKA_REQUEST_TIMEOUT_MS', { infer: true }),
    retryInitialTimeMs: config.get('KAFKA_RETRY_INITIAL_TIME_MS', { infer: true }),
    retryCount: config.get('KAFKA_RETRY_COUNT', { infer: true }),
  };
}

export function consumerConfig(config: ConfigService<Env, true>): TransactionCreatedConsumerConfig {
  return {
    ...kafkaClientConfig(config),
    groupId: config.get('KAFKA_GROUP_ID_ANTI_FRAUD', { infer: true }),
    sessionTimeoutMs: config.get('KAFKA_SESSION_TIMEOUT_MS', { infer: true }),
    maxAttempts: config.get('KAFKA_CONSUMER_MAX_ATTEMPTS', { infer: true }),
    retryDelayMs: config.get('KAFKA_CONSUMER_RETRY_DELAY_MS', { infer: true }),
  };
}
