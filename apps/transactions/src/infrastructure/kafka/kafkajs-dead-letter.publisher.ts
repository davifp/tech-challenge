import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import {
  deadLetterTopicFor,
  failedKafkaMessageV1Schema,
  type FailedKafkaMessageV1,
} from '@tech-challenge/event-contracts';
import { Kafka, Partitioners, type Producer } from 'kafkajs';

import { type DeadLetterPublisher } from '../../application/ports/dead-letter-publisher.port';

import { type TransactionStatusConsumerConfig } from './transaction-status-consumer.config';

@Injectable()
export class KafkaJsDeadLetterPublisher implements DeadLetterPublisher, OnApplicationShutdown {
  private readonly producer: Producer;
  private connection?: Promise<void>;

  constructor(config: TransactionStatusConsumerConfig) {
    const kafka = new Kafka({
      brokers: config.brokers,
      clientId: `${config.clientId}-status-dlq`,
      connectionTimeout: config.connectionTimeoutMs,
      requestTimeout: config.requestTimeoutMs,
      retry: { initialRetryTime: config.retryInitialTimeMs, retries: config.retryCount },
    });
    this.producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  }

  async publishDeadLetter(message: FailedKafkaMessageV1): Promise<void> {
    const validMessage = failedKafkaMessageV1Schema.parse(message);
    await this.connect();
    await this.producer.send({
      topic: deadLetterTopicFor(validMessage.sourceTopic),
      messages: [{ key: validMessage.originalKey, value: JSON.stringify(validMessage) }],
    });
  }

  async disconnect(): Promise<void> {
    await this.connection?.catch(() => undefined);
    await this.producer.disconnect();
    this.connection = undefined;
  }

  async onApplicationShutdown(): Promise<void> {
    await this.disconnect();
  }

  private connect(): Promise<void> {
    this.connection ??= this.producer.connect().catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
}
