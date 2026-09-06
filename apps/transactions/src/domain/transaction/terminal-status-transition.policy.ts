import {
  PENDING_STATUS_ID,
  type FinalTransactionStatusId,
  type TransactionStatusId,
} from './transaction-status';

export type TerminalStatusTransition = 'apply' | 'duplicate' | 'conflict';

export function decideTerminalStatusTransition(
  currentStatusId: TransactionStatusId,
  requestedStatusId: FinalTransactionStatusId,
): TerminalStatusTransition {
  if (currentStatusId === PENDING_STATUS_ID) return 'apply';
  return currentStatusId === requestedStatusId ? 'duplicate' : 'conflict';
}
