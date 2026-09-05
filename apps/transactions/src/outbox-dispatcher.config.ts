import { type ConfigService } from '@nestjs/config';

import { type Env } from './infrastructure/config/env.schema';
import { type KafkaPublisherConfig } from './infrastructure/kafka/kafkajs-event.publisher';
import { type OutboxRunnerConfig } from './infrastructure/kafka/outbox-dispatcher.runner';

export function kafkaPublisherConfig(config: ConfigService<Env, true>): KafkaPublisherConfig {
  return {
    brokers: config.get('KAFKA_BROKERS', { infer: true }),
    clientId: config.get('KAFKA_CLIENT_ID', { infer: true }),
    connectionTimeoutMs: config.get('KAFKA_CONNECTION_TIMEOUT_MS', { infer: true }),
    requestTimeoutMs: config.get('KAFKA_REQUEST_TIMEOUT_MS', { infer: true }),
    retryInitialTimeMs: config.get('KAFKA_RETRY_INITIAL_TIME_MS', { infer: true }),
    retryCount: config.get('KAFKA_RETRY_COUNT', { infer: true }),
  };
}

export function outboxRunnerConfig(config: ConfigService<Env, true>): OutboxRunnerConfig {
  const nodeEnv = config.get('NODE_ENV', { infer: true });
  return {
    enabled: config.get('OUTBOX_DISPATCH_ENABLED', { infer: true }) ?? nodeEnv !== 'test',
    pollIntervalMs: config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true }),
    batchSize: config.get('OUTBOX_BATCH_SIZE', { infer: true }),
    retryBaseDelayMs: config.get('OUTBOX_RETRY_BASE_DELAY_MS', { infer: true }),
    retryMaxDelayMs: config.get('OUTBOX_RETRY_MAX_DELAY_MS', { infer: true }),
  };
}
