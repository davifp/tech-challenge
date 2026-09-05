import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { TRANSACTION_CREATED_TOPIC } from '@tech-challenge/event-contracts';
import { type Consumer, type EachMessagePayload } from 'kafkajs';

import { kafkaCorrelationContext } from './kafka-log-context';
import { type KafkaRecord } from './kafka-record';
import { type TransactionCreatedConsumerConfig } from './kafka.config';
import { createKafkaClient } from './kafkajs-client.factory';
import { type TransactionCreatedMessageProcessor } from './transaction-created-message.processor';

@Injectable()
export class TransactionCreatedConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TransactionCreatedConsumer.name);
  private readonly consumer: Consumer;

  constructor(
    config: TransactionCreatedConsumerConfig,
    private readonly processor: TransactionCreatedMessageProcessor,
  ) {
    const kafka = createKafkaClient(config);
    this.consumer = kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeoutMs,
      allowAutoTopicCreation: true,
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.start();
  }

  async start(): Promise<void> {
    try {
      await this.connectAndRun();
    } catch (error: unknown) {
      await this.consumer.disconnect();
      throw error;
    }
    this.logger.log({
      component: 'kafka_consumer',
      topic: TRANSACTION_CREATED_TOPIC,
      outcome: 'connected',
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer.disconnect();
    this.logger.log({
      component: 'kafka_consumer',
      topic: TRANSACTION_CREATED_TOPIC,
      outcome: 'disconnected',
    });
  }

  private async handle(payload: EachMessagePayload): Promise<void> {
    const record = this.toRecord(payload);
    this.logger.log({
      eventName: TRANSACTION_CREATED_TOPIC,
      topic: record.topic,
      partition: record.partition,
      offset: record.offset,
      ...kafkaCorrelationContext(record),
      outcome: 'consumed',
    });
    await this.processor.process(record, payload.heartbeat);
    await this.consumer.commitOffsets([
      { topic: record.topic, partition: record.partition, offset: nextOffset(record.offset) },
    ]);
  }

  private toRecord(payload: EachMessagePayload): KafkaRecord {
    return {
      topic: payload.topic,
      partition: payload.partition,
      offset: payload.message.offset,
      key: payload.message.key?.toString('utf8') ?? null,
      value: payload.message.value?.toString('utf8') ?? null,
    };
  }

  private async connectAndRun(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TRANSACTION_CREATED_TOPIC, fromBeginning: false });
    await this.consumer.run({ autoCommit: false, eachMessage: (payload) => this.handle(payload) });
  }
}

export function nextOffset(offset: string): string {
  return (BigInt(offset) + 1n).toString();
}
