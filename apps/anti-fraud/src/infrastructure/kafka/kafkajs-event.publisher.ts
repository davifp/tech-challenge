import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  deadLetterTopicFor,
  failedKafkaMessageV1Schema,
  transactionStatusUpdatedV1Schema,
  type FailedKafkaMessageV1,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';
import { Partitioners, type Producer, type RecordMetadata } from 'kafkajs';

import { type DeadLetterPublisher } from '../../application/ports/dead-letter-publisher.port';
import { type TransactionStatusPublisher } from '../../application/ports/transaction-status-publisher.port';

import { type KafkaClientConfig } from './kafka.config';
import { createKafkaClient } from './kafkajs-client.factory';

type KafkaPublication = { topic: string; key: string | null; value: string };

@Injectable()
export class KafkaJsEventPublisher
  implements TransactionStatusPublisher, DeadLetterPublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(KafkaJsEventPublisher.name);
  private readonly producer: Producer;
  private connection?: Promise<void>;

  constructor(config: KafkaClientConfig) {
    const kafka = createKafkaClient(config);
    this.producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
    this.logger.log({ component: 'kafka_producer', outcome: 'connected' });
  }

  async publish(event: TransactionStatusUpdatedV1): Promise<void> {
    const validEvent = transactionStatusUpdatedV1Schema.parse(event);
    const metadata = await this.send({
      topic: validEvent.eventName,
      key: validEvent.data.transactionExternalId,
      value: JSON.stringify(validEvent),
    });
    this.logger.log({
      eventName: validEvent.eventName,
      eventId: validEvent.eventId,
      transactionExternalId: validEvent.data.transactionExternalId,
      correlationId: validEvent.correlationId,
      topic: metadata.topicName,
      partition: metadata.partition,
      offset: metadata.baseOffset,
      outcome: 'published',
    });
  }

  async publishDeadLetter(message: FailedKafkaMessageV1): Promise<void> {
    const validMessage = failedKafkaMessageV1Schema.parse(message);
    await this.send({
      topic: deadLetterTopicFor(validMessage.sourceTopic),
      key: validMessage.originalKey,
      value: JSON.stringify(validMessage),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.connection?.catch(() => undefined);
    await this.producer.disconnect();
    this.connection = undefined;
    this.logger.log({ component: 'kafka_producer', outcome: 'disconnected' });
  }

  private async send(publication: KafkaPublication): Promise<RecordMetadata> {
    await this.connect();
    const [metadata] = await this.producer.send({
      topic: publication.topic,
      messages: [{ key: publication.key, value: publication.value }],
    });
    if (!metadata) throw new Error('Kafka did not return publication metadata');
    return metadata;
  }

  private connect(): Promise<void> {
    this.connection ??= this.producer.connect().catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }
}
