import Link from 'next/link';

import { CopyIdentifierButton } from '../../components/copy-identifier-button';
import { StatusBadge } from '../../components/status-badge';
import type { TransactionResponse } from '../../contracts';
import { formatCurrency, formatDateTime, transactionTypeLabel } from '../../presentation';
import { buildTransactionDetailHref, type TransactionsSearch } from '../url-state/search';

type TransactionsListProps = {
  currentSearch: TransactionsSearch;
  items: ReadonlyArray<TransactionResponse>;
};

const SHORT_IDENTIFIER_LENGTH = 8;

function shortIdentifierLabel(identifier: string): string {
  return `#${identifier.slice(0, SHORT_IDENTIFIER_LENGTH).toUpperCase()}`;
}

export function TransactionsList({ currentSearch, items }: TransactionsListProps) {
  return (
    <section aria-label="Lista de transações">
      <ul className="divide-y divide-surface-variant lg:hidden">
        {items.map((transaction) => {
          const detailHref = buildTransactionDetailHref(
            transaction.transactionExternalId,
            currentSearch,
          );
          return (
            <li key={transaction.transactionExternalId}>
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-1">
                    <Link
                      aria-label={`Abrir detalhe da transação ${shortIdentifierLabel(transaction.transactionExternalId)}`}
                      className="tabular min-w-0 truncate text-[13px] font-semibold text-primary-container hover:underline focus-visible:underline"
                      href={detailHref}
                      title={transaction.transactionExternalId}
                      translate="no"
                    >
                      {transaction.transactionExternalId}
                    </Link>
                    <CopyIdentifierButton
                      label={`Copiar identificador ${shortIdentifierLabel(transaction.transactionExternalId)}`}
                      value={transaction.transactionExternalId}
                    />
                  </div>
                  <span className="text-[12px] text-on-surface-variant">
                    <time dateTime={transaction.createdAt}>
                      {formatDateTime(transaction.createdAt)}
                    </time>
                    <span aria-hidden="true"> · </span>
                    {transactionTypeLabel(transaction.transactionType.name)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-[14px] font-semibold text-on-surface">
                    <data value={transaction.value}>{formatCurrency(transaction.value)}</data>
                  </span>
                  <StatusBadge size="sm" status={transaction.transactionStatus.name} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Transações encontradas</caption>
          <thead>
            <tr className="border-b border-surface-container-high bg-surface-container-low text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
              <th className="px-6 py-3" scope="col">
                Identificador
              </th>
              <th className="px-4 py-3" scope="col">
                Data e hora
              </th>
              <th className="px-4 py-3 text-right" scope="col">
                Valor
              </th>
              <th className="px-4 py-3 text-center" scope="col">
                Status
              </th>
              <th className="px-6 py-3" scope="col">
                Tipo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant">
            {items.map((transaction) => {
              const detailHref = buildTransactionDetailHref(
                transaction.transactionExternalId,
                currentSearch,
              );
              return (
                <tr
                  className="transition-colors hover:bg-surface-container-low/60"
                  key={transaction.transactionExternalId}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <Link
                        className="tabular block max-w-[26ch] truncate text-[13px] font-semibold text-primary-container hover:underline focus-visible:underline"
                        href={detailHref}
                        title={transaction.transactionExternalId}
                        translate="no"
                      >
                        {transaction.transactionExternalId}
                      </Link>
                      <CopyIdentifierButton
                        label={`Copiar identificador ${shortIdentifierLabel(transaction.transactionExternalId)}`}
                        value={transaction.transactionExternalId}
                      />
                    </div>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-4 text-[14px] text-on-surface-variant">
                    <time dateTime={transaction.createdAt}>
                      {formatDateTime(transaction.createdAt)}
                    </time>
                  </td>
                  <td className="tabular whitespace-nowrap px-4 py-4 text-right text-[14px] font-semibold text-on-surface">
                    <data value={transaction.value}>{formatCurrency(transaction.value)}</data>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-center">
                    <StatusBadge status={transaction.transactionStatus.name} />
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-[14px] text-on-surface-variant">
                    {transactionTypeLabel(transaction.transactionType.name)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
