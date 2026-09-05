export class InvalidTransactionError extends Error {
  readonly code = 'INVALID_TRANSACTION';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}
