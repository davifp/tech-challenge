import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_CREATED_TOPIC,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';

export function transactionCreatedEvent(input: {
  eventId: string;
  transactionExternalId: string;
  value: number;
}): TransactionCreatedV1 {
  return {
    eventId: input.eventId,
    eventName: TRANSACTION_CREATED_TOPIC,
    version: INTEGRATION_EVENT_VERSION,
    correlationId: input.transactionExternalId,
    causationId: null,
    data: { transactionExternalId: input.transactionExternalId, value: input.value },
  };
}
