import { Injectable } from '@nestjs/common';
import {
  transactionCreatedV1Schema,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';
import { Kafka, Partitioners, type Producer } from 'kafkajs';

import {
  type EventPublisher,
  type PublishedEventMetadata,
} from '../../application/ports/event-publisher.port';

const UNAVAILABLE_OFFSET = 'unavailable';

export type KafkaPublisherConfig = {
  brokers: string[];
  clientId: string;
  connectionTimeoutMs: number;
  requestTimeoutMs: number;
  retryInitialTimeMs: number;
  retryCount: number;
};

@Injectable()
export class KafkaJsEventPublisher implements EventPublisher {
  private readonly producer: Producer;
  private connection?: Promise<void>;

  constructor(config: KafkaPublisherConfig) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      connectionTimeout: config.connectionTimeoutMs,
      requestTimeout: config.requestTimeoutMs,
      retry: { initialRetryTime: config.retryInitialTimeMs, retries: config.retryCount },
    });
    this.producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  }

  async publish(event: TransactionCreatedV1): Promise<PublishedEventMetadata> {
    const validatedEvent = transactionCreatedV1Schema.parse(event);
    await this.connect();
    const [metadata] = await this.producer.send({
      topic: validatedEvent.eventName,
      messages: [
        {
          key: validatedEvent.data.transactionExternalId,
          value: JSON.stringify(validatedEvent),
        },
      ],
    });
    if (!metadata) throw new Error('Kafka did not return publication metadata');
    return {
      topic: metadata.topicName,
      partition: metadata.partition,
      offset: metadata.baseOffset ?? UNAVAILABLE_OFFSET,
    };
  }

  async disconnect(): Promise<void> {
    await this.connection?.catch(() => undefined);
    await this.producer.disconnect();
    this.connection = undefined;
  }

  private connect(): Promise<void> {
    this.connection ??= this.producer.connect().catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
}
