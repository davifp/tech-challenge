import {
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { TRANSACTION_STATUS_UPDATED_TOPIC } from '@tech-challenge/event-contracts';
import { type EachMessagePayload } from 'kafkajs';

import { nextOffset, toKafkaRecord } from '../shared/kafka-record';
import { sanitizeKafkaError } from '../shared/sanitize-kafka-error';

import { kafkaConsumerLifecycleContext, kafkaCorrelationContext } from './kafka-log-context';
import {
  createTransactionStatusConsumer,
  type KafkaConsumer,
} from './kafkajs-status-consumer.factory';
import { type TransactionStatusConsumerConfig } from './transaction-status-consumer.config';
import { type TransactionStatusMessageProcessor } from './transaction-status-message.processor';

@Injectable()
export class TransactionStatusConsumer
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TransactionStatusConsumer.name);
  private readonly consumer: KafkaConsumer;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private starting?: Promise<void>;
  private stopped = true;

  constructor(
    private readonly config: TransactionStatusConsumerConfig,
    private readonly processor: TransactionStatusMessageProcessor,
  ) {
    this.consumer = createTransactionStatusConsumer(config, async () => !this.stopped);
  }

  onApplicationBootstrap(): void {
    if (!this.config.enabled) return;
    this.stopped = false;
    this.scheduleStart(0);
  }

  async start(): Promise<void> {
    this.stopped = false;
    await this.connectAndRun();
  }

  async beforeApplicationShutdown(): Promise<void> {
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
    await this.consumer.subscribe({
      topic: TRANSACTION_STATUS_UPDATED_TOPIC,
      fromBeginning: false,
    });
    await this.consumer.run({ autoCommit: false, eachMessage: (payload) => this.handle(payload) });
    this.logger.log(kafkaConsumerLifecycleContext('connected'));
  }

  private async handle(payload: EachMessagePayload): Promise<void> {
    const record = toKafkaRecord(payload);
    this.logger.log({
      eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
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
