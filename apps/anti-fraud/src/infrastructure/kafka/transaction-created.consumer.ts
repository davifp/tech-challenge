import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { TRANSACTION_CREATED_TOPIC } from '@tech-challenge/event-contracts';
import { type Consumer, type EachMessagePayload } from 'kafkajs';

import { kafkaConsumerLifecycleContext, kafkaCorrelationContext } from './kafka-log-context';
import { nextOffset, toKafkaRecord } from './kafka-record';
import { type TransactionCreatedConsumerConfig } from './kafka.config';
import { createKafkaClient } from './kafkajs-client.factory';
import { sanitizeKafkaError } from './sanitize-kafka-error';
import { type TransactionCreatedMessageProcessor } from './transaction-created-message.processor';

@Injectable()
export class TransactionCreatedConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TransactionCreatedConsumer.name);
  private readonly consumer: Consumer;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private starting?: Promise<void>;
  private stopped = true;

  constructor(
    private readonly config: TransactionCreatedConsumerConfig,
    private readonly processor: TransactionCreatedMessageProcessor,
  ) {
    const kafka = createKafkaClient(config);
    this.consumer = kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeoutMs,
      allowAutoTopicCreation: true,
      retry: { restartOnFailure: async () => !this.stopped },
    });
  }

  onApplicationBootstrap(): void {
    this.stopped = false;
    this.scheduleStart(0);
  }

  async start(): Promise<void> {
    this.stopped = false;
    try {
      await this.connectAndRun();
    } catch (error: unknown) {
      await this.consumer.disconnect().catch(() => undefined);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    await this.starting?.catch(() => undefined);
    await this.consumer.disconnect();
    this.logger.log(kafkaConsumerLifecycleContext('disconnected'));
  }

  private scheduleStart(delayMs: number): void {
    if (this.stopped) return;
    this.reconnectTimer = setTimeout(() => this.startInBackground(), delayMs);
  }

  private startInBackground(): void {
    this.starting = this.connectAndRun()
      .catch(async (error: unknown) => {
        await this.consumer.disconnect().catch(() => undefined);
        this.logger.error({
          ...kafkaConsumerLifecycleContext('retry_scheduled'),
          error: sanitizeKafkaError(error),
        });
        this.scheduleStart(this.config.retryDelayMs);
      })
      .finally(() => {
        this.starting = undefined;
      });
  }

  private async connectAndRun(): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: TRANSACTION_CREATED_TOPIC, fromBeginning: false });
    await this.consumer.run({ autoCommit: false, eachMessage: (payload) => this.handle(payload) });
    this.logger.log(kafkaConsumerLifecycleContext('connected'));
  }

  private async handle(payload: EachMessagePayload): Promise<void> {
    const record = toKafkaRecord(payload);
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
}
