import { randomUUID } from 'node:crypto';

import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_STATUS_UPDATED_TOPIC,
  type FinalTransactionStatus,
  type TransactionStatusUpdatedV1,
} from '@tech-challenge/event-contracts';

export function transactionStatusEvent(input: {
  transactionExternalId: string;
  status: FinalTransactionStatus;
  eventId?: string;
}): TransactionStatusUpdatedV1 {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
    version: INTEGRATION_EVENT_VERSION,
    correlationId: input.transactionExternalId,
    causationId: randomUUID(),
    data: {
      transactionExternalId: input.transactionExternalId,
      status: input.status,
    },
  };
}
