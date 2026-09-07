import type { TransactionStatus } from '../contracts';
import { transactionStatusLabel } from '../presentation';

import { IconCheck, IconClock, IconClose } from '@/components/shared/icons';

type StatusBadgeSize = 'sm' | 'md';

type StatusBadgeProps = {
  status: TransactionStatus;
  size?: StatusBadgeSize;
};

const STATUS_STYLES: Record<TransactionStatus, string> = {
  pending: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
  approved: 'bg-secondary-container/40 text-secondary',
  rejected: 'bg-error-container text-error',
};

const STATUS_ICONS: Record<TransactionStatus, typeof IconCheck> = {
  pending: IconClock,
  approved: IconCheck,
  rejected: IconClose,
};

const SIZE_STYLES: Record<StatusBadgeSize, { container: string; icon: string }> = {
  sm: {
    container: 'gap-0.5 rounded-full px-1.5 py-0.5 text-[10px]',
    icon: 'h-2.5 w-2.5',
  },
  md: {
    container: 'gap-1 rounded-full px-2.5 py-1 text-[11px]',
    icon: 'h-3.5 w-3.5',
  },
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const IconComponent = STATUS_ICONS[status];
  const sizeStyles = SIZE_STYLES[size];
  return (
    <span
      aria-live="polite"
      className={`inline-flex items-center font-semibold uppercase tracking-wide ${sizeStyles.container} ${STATUS_STYLES[status]}`}
      role="status"
    >
      <IconComponent className={sizeStyles.icon} />
      {transactionStatusLabel(status)}
    </span>
  );
}
