import {
  createTransactionStatusEventId,
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type TransactionCreatedV1,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';

import { type AntiFraudDecision } from '../../domain/anti-fraud/anti-fraud-policy';

export function createTransactionStatusUpdatedEvent(
  event: TransactionCreatedV1,
  decision: AntiFraudDecision,
): TransactionStatusUpdatedV1 {
  return {
    eventId: createTransactionStatusEventId(event.eventId),
    eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
    version: INTEGRATION_EVENT_VERSION,
    correlationId: event.data.transactionExternalId,
    causationId: event.eventId,
    data: {
      transactionExternalId: event.data.transactionExternalId,
      status: decision,
    },
  };
}
