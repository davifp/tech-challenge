export class TransactionNotFoundError extends Error {
  readonly code = 'TRANSACTION_NOT_FOUND';
  readonly transactionExternalId: string;

  constructor(transactionExternalId: string) {
    super(`Transaction ${transactionExternalId} not found`);
    this.name = 'TransactionNotFoundError';
    this.transactionExternalId = transactionExternalId;
  }
}
