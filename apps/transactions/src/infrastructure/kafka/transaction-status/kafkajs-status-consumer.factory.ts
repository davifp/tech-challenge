import { Kafka, type Consumer } from 'kafkajs';

import { type TransactionStatusConsumerConfig } from './transaction-status-consumer.config';

export type KafkaConsumer = Pick<
  Consumer,
  'connect' | 'subscribe' | 'run' | 'disconnect' | 'commitOffsets'
>;

export function createTransactionStatusConsumer(
  config: TransactionStatusConsumerConfig,
  restartOnFailure: (err: Error) => Promise<boolean>,
): KafkaConsumer {
  const kafka = new Kafka({
    brokers: config.brokers,
    clientId: `${config.clientId}-status-consumer`,
    connectionTimeout: config.connectionTimeoutMs,
    requestTimeout: config.requestTimeoutMs,
    retry: { initialRetryTime: config.retryInitialTimeMs, retries: config.retryCount },
  });
  return kafka.consumer({
    groupId: config.groupId,
    sessionTimeout: config.sessionTimeoutMs,
    allowAutoTopicCreation: true,
    retry: { restartOnFailure },
  });
}
