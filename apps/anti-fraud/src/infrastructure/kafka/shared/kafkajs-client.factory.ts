import { Kafka } from 'kafkajs';

import { type KafkaClientConfig } from './kafka.config';

export function createKafkaClient(config: KafkaClientConfig): Kafka {
  return new Kafka({
    clientId: config.clientId,
    brokers: config.brokers,
    connectionTimeout: config.connectionTimeoutMs,
    requestTimeout: config.requestTimeoutMs,
    retry: { initialRetryTime: config.retryInitialTimeMs, retries: config.retryCount },
  });
}
