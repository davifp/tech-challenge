import type { TransactionStatus } from '../contracts';
import { transactionStatusLabel } from '../presentation';

type StatusBadgeProps = {
  status: TransactionStatus;
};

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  rejected: 'border-red-300 bg-red-50 text-red-900',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${STATUS_STYLES[status]}`}
    >
      {transactionStatusLabel(status)}
    </span>
  );
}
