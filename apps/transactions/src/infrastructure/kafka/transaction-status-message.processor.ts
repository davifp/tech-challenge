import { Logger } from '@nestjs/common';

import { TransactionDecisionConflictError } from '../../application/errors/transaction-decision-conflict.error';
import { type DeadLetterPublisher } from '../../application/ports/dead-letter-publisher.port';
import { type ApplyTransactionStatusUseCase } from '../../application/use-cases/apply-transaction-status.use-case';

import { createFailedKafkaMessage } from './failed-kafka-message.factory';
import { kafkaFailureContext } from './kafka-log-context';
import { type KafkaRecord } from './kafka-record';
import { classifyKafkaFailure, wait } from './kafka-retry-policy';
import { PermanentKafkaMessageError } from './permanent-kafka-message.error';
import { transactionStatusEventContext } from './transaction-status-log-context';
import { parseTransactionStatusRecord } from './transaction-status-record.parser';

type ProcessorDependencies = {
  applyTransactionStatus: ApplyTransactionStatusUseCase;
  deadLetterPublisher: DeadLetterPublisher;
};
type ProcessorConfig = {
  maxAttempts: number;
  retryDelayMs: number;
  now?: () => Date;
  delay?: (delayMs: number) => Promise<void>;
};
type AttemptResult = { succeeded: true } | { succeeded: false; error: unknown };

export class TransactionStatusMessageProcessor {
  private readonly logger = new Logger(TransactionStatusMessageProcessor.name);
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
      const result = await this.attempt(record, attempt);
      if (result.succeeded) return;
      const error = this.normalizeError(result.error);
      const action = classifyKafkaFailure(error, attempt, this.config.maxAttempts);
      if (action === 'dead-letter') {
        await this.deadLetter(record, error, attempt);
        return;
      }
      await this.waitForRetry(record, error, attempt, heartbeat);
    }
  }

  private async attempt(record: KafkaRecord, attempt: number): Promise<AttemptResult> {
    try {
      const event = parseTransactionStatusRecord(record);
      const outcome = await this.dependencies.applyTransactionStatus.execute({
        eventId: event.eventId,
        transactionExternalId: event.data.transactionExternalId,
        status: event.data.status,
      });
      this.logger.log({ ...transactionStatusEventContext({ record, event, attempt }), outcome });
      return { succeeded: true };
    } catch (error: unknown) {
      if (error instanceof TransactionDecisionConflictError) {
        this.logger.warn(kafkaFailureContext(record, error, attempt, 'conflict'));
      }
      return { succeeded: false, error };
    }
  }

  private normalizeError(error: unknown): unknown {
    if (!(error instanceof TransactionDecisionConflictError)) return error;
    return new PermanentKafkaMessageError(error.code, error.message);
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
