import { createTransaction } from './transaction.factory';

const BASE_TIME = Date.parse('2026-09-01T12:00:00.000Z');
const MINUTE_IN_MILLISECONDS = 60_000;

export function createTimedTransactions(count: number) {
  return Promise.all(
    Array.from({ length: count }, (_, index) =>
      createTransaction({ createdAt: new Date(BASE_TIME + index * MINUTE_IN_MILLISECONDS) }),
    ),
  );
}

export function externalIds(records: Array<{ transactionExternalId: string }>): string[] {
  return records.map(({ transactionExternalId }) => transactionExternalId);
}
