import type { TransactionPage, TransactionResponse, TransactionStatus } from './contracts';

const TERMINAL_STATUSES: ReadonlySet<TransactionStatus> = new Set(['approved', 'rejected']);

export function isTerminalStatus(status: TransactionStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function hasPendingItems(page: TransactionPage): boolean {
  return page.items.some((item) => item.transactionStatus.name === 'pending');
}

export function reconcileTransaction(
  prev: TransactionResponse | undefined,
  next: TransactionResponse,
): TransactionResponse {
  if (!prev) return next;
  const previousStatus = prev.transactionStatus.name;
  const nextStatus = next.transactionStatus.name;
  if (isTerminalStatus(previousStatus) && nextStatus !== previousStatus) return prev;
  if (isTerminalStatus(nextStatus) && !isTerminalStatus(previousStatus)) return next;
  if (Date.parse(next.updatedAt) <= Date.parse(prev.updatedAt)) return prev;
  return next;
}

export function reconcileTransactionPage(
  prev: TransactionPage | undefined,
  next: TransactionPage,
): TransactionPage {
  if (!prev) return next;
  const prevById = new Map(prev.items.map((item) => [item.transactionExternalId, item]));
  const reconciledItems = next.items.map((item) =>
    reconcileTransaction(prevById.get(item.transactionExternalId), item),
  );
  return { ...next, items: reconciledItems };
}
