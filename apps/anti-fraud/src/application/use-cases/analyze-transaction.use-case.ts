import {
  type TransactionCreatedV1,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';

import { type AntiFraudPolicy } from '../../domain/anti-fraud/anti-fraud-policy';
import { createTransactionStatusUpdatedEvent } from '../helpers/create-transaction-status-updated-event';
import { type TransactionStatusPublisher } from '../ports/transaction-status-publisher.port';

export class AnalyzeTransactionUseCase {
  constructor(
    private readonly policy: AntiFraudPolicy,
    private readonly publisher: TransactionStatusPublisher,
  ) {}

  async execute(event: TransactionCreatedV1): Promise<TransactionStatusUpdatedV1> {
    const decision = this.policy.decide(event.data.value);
    const decisionEvent = createTransactionStatusUpdatedEvent(event, decision);
    await this.publisher.publish(decisionEvent);
    return decisionEvent;
  }
}
