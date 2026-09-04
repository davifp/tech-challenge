export class IdempotencyKeyConflictError extends Error {
  readonly code = 'IDEMPOTENCY_KEY_CONFLICT';
  readonly idempotencyKey: string;

  constructor(idempotencyKey: string) {
    super(`Idempotency-Key ${idempotencyKey} reused with a different body`);
    this.name = 'IdempotencyKeyConflictError';
    this.idempotencyKey = idempotencyKey;
  }
}
