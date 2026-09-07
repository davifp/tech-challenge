import type { ReactNode } from 'react';

import { CopyIdentifierButton } from '../../components/copy-identifier-button';
import { StatusBadge } from '../../components/status-badge';
import type { TransactionResponse } from '../../contracts';
import {
  BUSINESS_TIME_ZONE_LABEL,
  formatCurrency,
  formatDateTime,
  transactionTypeLabel,
} from '../../presentation';

type TransactionDetailProps = {
  transaction: TransactionResponse;
};

type FieldProps = {
  label: string;
  children: ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

type IdentifierFieldProps = {
  label: string;
  value: string;
};

function IdentifierField({ label, value }: IdentifierFieldProps) {
  return (
    <Field label={label}>
      <span className="flex min-w-0 items-center gap-1">
        <span
          className="tabular min-w-0 truncate text-[13px] font-semibold text-on-surface"
          title={value}
          translate="no"
        >
          {value}
        </span>
        <CopyIdentifierButton label={`Copiar ${label.toLowerCase()}`} value={value} />
      </span>
    </Field>
  );
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  return (
    <dl className="grid gap-6 rounded-xl border border-surface-container-high/60 bg-surface-container-lowest p-6 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Identificador">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className="tabular min-w-0 truncate text-[13px] font-semibold text-on-surface"
            title={transaction.transactionExternalId}
            translate="no"
          >
            {transaction.transactionExternalId}
          </span>
          <CopyIdentifierButton
            label="Copiar identificador da transação"
            value={transaction.transactionExternalId}
          />
        </span>
      </Field>
      <Field label="Tipo">
        <span className="text-[14px] font-semibold text-on-surface">
          {transactionTypeLabel(transaction.transactionType.name)}
        </span>
      </Field>
      <Field label="Status">
        <StatusBadge status={transaction.transactionStatus.name} />
      </Field>
      <Field label="Valor">
        <data
          className="tabular text-[14px] font-semibold text-on-surface"
          value={transaction.value}
        >
          {formatCurrency(transaction.value)}
        </data>
      </Field>
      <Field label="Criada em">
        <time
          className="text-[14px] font-semibold text-on-surface"
          dateTime={transaction.createdAt}
        >
          {formatDateTime(transaction.createdAt)}
        </time>
        <span className="mt-0.5 block text-[11px] text-on-surface-variant">
          {BUSINESS_TIME_ZONE_LABEL}
        </span>
      </Field>
      <Field label="Atualizada em">
        <time
          className="text-[14px] font-semibold text-on-surface"
          dateTime={transaction.updatedAt}
        >
          {formatDateTime(transaction.updatedAt)}
        </time>
        <span className="mt-0.5 block text-[11px] text-on-surface-variant">
          {BUSINESS_TIME_ZONE_LABEL}
        </span>
      </Field>
      <IdentifierField label="Conta de débito" value={transaction.accountExternalIdDebit} />
      <IdentifierField label="Conta de crédito" value={transaction.accountExternalIdCredit} />
    </dl>
  );
}
