import { Logger } from '@nestjs/common';

import { type DeadLetterPublisher } from '../../application/ports/dead-letter-publisher.port';
import { type AnalyzeTransactionUseCase } from '../../application/use-cases/analyze-transaction.use-case';

import { createFailedKafkaMessage } from './failed-kafka-message.factory';
import { kafkaFailureContext } from './kafka-log-context';
import { type KafkaRecord } from './kafka-record';
import { classifyKafkaFailure, wait } from './kafka-retry-policy';
import { parseTransactionCreatedRecord } from './transaction-created-record.parser';

type ProcessorDependencies = {
  analyzeTransaction: AnalyzeTransactionUseCase;
  deadLetterPublisher: DeadLetterPublisher;
};
type ProcessorConfig = {
  maxAttempts: number;
  retryDelayMs: number;
  now?: () => Date;
  delay?: (delayMs: number) => Promise<void>;
};
type AttemptResult = { succeeded: true } | { succeeded: false; error: unknown };

export class TransactionCreatedMessageProcessor {
  private readonly logger = new Logger(TransactionCreatedMessageProcessor.name);
  private readonly now: () => Date;
  private readonly delay: (delayMs: number) => Promise<void>;

  constructor(
    private readonly dependencies: ProcessorDependencies,
    private readonly config: ProcessorConfig,
  ) {
    this.now = config.now ?? (() => new Date());
    this.delay = config.delay ?? wait;
  }

  async process(record: KafkaRecord, heartbeat: () => Promise<void>): Promise<void> {
    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt += 1) {
      const result = await this.attempt(record);
      if (result.succeeded) return;
      const action = classifyKafkaFailure(result.error, attempt, this.config.maxAttempts);
      if (action === 'dead-letter') {
        await this.deadLetter(record, result.error, attempt);
        return;
      }
      await this.waitForRetry(record, result.error, attempt, heartbeat);
    }
  }

  private async attempt(record: KafkaRecord): Promise<AttemptResult> {
    try {
      const event = parseTransactionCreatedRecord(record);
      const decision = await this.dependencies.analyzeTransaction.execute(event);
      this.logger.log({
        eventName: event.eventName,
        eventId: event.eventId,
        transactionExternalId: event.data.transactionExternalId,
        correlationId: event.correlationId,
        outcome: 'processed',
        decision: decision.data.status,
      });
      return { succeeded: true };
    } catch (error: unknown) {
      return { succeeded: false, error };
    }
  }

  private async waitForRetry(
    record: KafkaRecord,
    error: unknown,
    attempt: number,
    heartbeat: () => Promise<void>,
  ): Promise<void> {
    this.logger.warn(kafkaFailureContext(record, error, attempt, 'retry_scheduled'));
    await heartbeat();
    await this.delay(this.config.retryDelayMs);
    await heartbeat();
  }

  private async deadLetter(record: KafkaRecord, error: unknown, attempts: number): Promise<void> {
    const message = createFailedKafkaMessage({ record, error, attempts, failedAt: this.now() });
    try {
      await this.dependencies.deadLetterPublisher.publishDeadLetter(message);
    } catch (publishError: unknown) {
      this.logger.error(kafkaFailureContext(record, publishError, attempts, 'dlq_publish_failed'));
      throw publishError;
    }
    this.logger.error(kafkaFailureContext(record, error, attempts, 'dead_lettered'));
  }
}
