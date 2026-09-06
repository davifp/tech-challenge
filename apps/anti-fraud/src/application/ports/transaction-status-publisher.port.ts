import { type TransactionStatusUpdatedV1 } from '@tech-challenge/event-contracts';

export const TRANSACTION_STATUS_PUBLISHER = Symbol('TransactionStatusPublisher');

export interface TransactionStatusPublisher {
  publish(event: TransactionStatusUpdatedV1): Promise<void>;
}
