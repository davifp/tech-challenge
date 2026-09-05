import { validate as isUuid, v5 as uuidV5 } from 'uuid';

const TRANSACTION_STATUS_DECISION_NAMESPACE = '8052c03f-9951-5760-a002-56e86841a938';

export function createTransactionStatusEventId(transactionCreatedEventId: string): string {
  if (!isUuid(transactionCreatedEventId)) {
    throw new TypeError('transactionCreatedEventId must be a UUID');
  }
  return uuidV5(transactionCreatedEventId, TRANSACTION_STATUS_DECISION_NAMESPACE);
}
