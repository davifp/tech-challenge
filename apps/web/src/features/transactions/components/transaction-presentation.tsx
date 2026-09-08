import {
  BUSINESS_TIME_ZONE_LABEL,
  formatCurrency,
  formatDateTime,
} from '../transaction-formatters';
import { transactionTypeLabel } from '../transaction-labels';
import type { TransactionResponse } from '../transaction-schemas';

import { StatusBadge } from './status-badge';

type TransactionPresentationProps = {
  transaction: TransactionResponse;
};

export function TransactionPresentation({ transaction }: TransactionPresentationProps) {
  return (
    <dl className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-500">Tipo</dt>
        <dd className="mt-1 font-semibold text-slate-900">
          {transactionTypeLabel(transaction.transactionType.name)}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-500">Valor</dt>
        <dd className="mt-1 font-semibold tabular-nums text-slate-900">
          <data value={transaction.value}>{formatCurrency(transaction.value)}</data>
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-500">Status</dt>
        <dd className="mt-1">
          <StatusBadge status={transaction.transactionStatus.name} />
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-sm font-medium text-slate-500">Criada em</dt>
        <dd className="mt-1 font-semibold tabular-nums text-slate-900">
          <time dateTime={transaction.createdAt}>{formatDateTime(transaction.createdAt)}</time>
          <span className="mt-1 block text-xs font-normal text-slate-500">
            {BUSINESS_TIME_ZONE_LABEL}
          </span>
        </dd>
      </div>
    </dl>
  );
}
