import type { TransactionStatus, TransactionType } from './transaction-schemas';

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

const TYPE_LABELS: Record<TransactionType, string> = {
  pix: 'Pix',
  ted: 'TED',
  book_transfer: 'Book Transfer',
};

export function transactionStatusLabel(status: string): string {
  return STATUS_LABELS[status as TransactionStatus] ?? 'Status desconhecido';
}

export function transactionTypeLabel(type: string): string {
  return TYPE_LABELS[type as TransactionType] ?? 'Tipo desconhecido';
}
