const INVALID_TRANSACTION_CODE = 'INVALID_TRANSACTION';

export class InvalidTransactionError extends Error {
  static readonly CODE = INVALID_TRANSACTION_CODE;
  readonly code = INVALID_TRANSACTION_CODE;

  constructor(message: string) {
    super(message);
    this.name = 'InvalidTransactionError';
  }
}
