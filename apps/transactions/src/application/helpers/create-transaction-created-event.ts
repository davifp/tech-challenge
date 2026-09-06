import {
  INTEGRATION_EVENT_VERSION,
  TRANSACTION_CREATED_TOPIC,
  type TransactionCreatedV1,
} from '@tech-challenge/event-contracts';
import { v7 as uuidv7 } from 'uuid';

import { type Transaction } from '../../domain/transaction/transaction';

export function createTransactionCreatedEvent(transaction: Transaction): TransactionCreatedV1 {
  return {
    eventId: uuidv7(),
    eventName: TRANSACTION_CREATED_TOPIC,
    version: INTEGRATION_EVENT_VERSION,
    correlationId: transaction.transactionExternalId,
    causationId: null,
    data: {
      transactionExternalId: transaction.transactionExternalId,
      value: transaction.value,
    },
  };
}
