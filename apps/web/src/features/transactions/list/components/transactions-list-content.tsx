import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';

import { TransactionsApiError } from '../../api/transactions-api';
import { EmptyState } from '../../components/empty-state';
import { ErrorState } from '../../components/error-state';
import { PollErrorBanner } from '../../components/poll-error-banner';
import { apiErrorMessage } from '../../transaction-error-messages';
import type { TransactionPage } from '../../transaction-schemas';
import { totalPages } from '../pagination';
import {
  hasActiveFilters,
  type TransactionSearchParams,
} from '../search-params/transaction-search-params';

import { ListContentSkeleton } from './list-content-skeleton';
import { PaginationBar } from './pagination-bar';
import { TransactionsList } from './transactions-list';

type TransactionsListContentProps = {
  currentSearch: TransactionSearchParams;
  onChangePage(page: number): void;
  onClearFilters(): void;
  query: UseQueryResult<TransactionPage, unknown>;
};

function errorMessageFrom(error: unknown): string {
  if (error instanceof TransactionsApiError) return apiErrorMessage(error.code);
  return apiErrorMessage('INTERNAL_ERROR');
}

export function TransactionsListContent({
  currentSearch,
  onChangePage,
  onClearFilters,
  query,
}: TransactionsListContentProps) {
  if (query.isLoading && !query.data) return <ListContentSkeleton />;
  if (query.isError && !query.data) {
    return (
      <ErrorState
        description={errorMessageFrom(query.error)}
        onRetry={() => void query.refetch()}
        title="Não foi possível carregar as transações"
      />
    );
  }
  const page = query.data;
  if (!page) return <ListContentSkeleton />;
  if (currentSearch.page > totalPages(page.total)) return <ListContentSkeleton />;
  const pollError = query.isError ? (
    <PollErrorBanner
      errorMessage={errorMessageFrom(query.error)}
      onRetry={() => void query.refetch()}
    />
  ) : null;
  if (page.total === 0 && hasActiveFilters(currentSearch)) {
    return (
      <>
        {pollError}
        <FilteredEmptyState onClear={onClearFilters} />
      </>
    );
  }
  if (page.total === 0) {
    return (
      <>
        {pollError}
        <BaseEmptyState />
      </>
    );
  }
  return (
    <>
      {pollError}
      <div className="overflow-hidden rounded-xl border border-surface-container-high/60 bg-surface-container-lowest shadow-soft">
        <TransactionsList currentSearch={currentSearch} items={page.items} />
        <PaginationBar onPageChange={onChangePage} page={page.page} total={page.total} />
      </div>
    </>
  );
}

function FilteredEmptyState({ onClear }: { onClear(): void }) {
  return (
    <EmptyState
      action={
        <button
          className="inline-flex h-10 items-center rounded-pill border border-hairline bg-canvas px-4 text-[13px] font-semibold text-body hover:text-ink"
          onClick={onClear}
          type="button"
        >
          Limpar filtros
        </button>
      }
      description="Nenhuma transação corresponde aos filtros aplicados. Ajuste ou limpe os filtros para ver outros resultados."
      title="Sem resultados para os filtros"
    />
  );
}

function BaseEmptyState() {
  return (
    <EmptyState
      action={
        <Link
          className="inline-flex h-10 items-center rounded-pill bg-primary px-4 text-[13px] font-semibold text-white hover:bg-primary-active"
          href="/transactions/new"
        >
          Criar primeira transação
        </Link>
      }
      description="Ainda não há transações registradas. Crie a primeira transferência para começar."
      title="Nenhuma transação por aqui"
    />
  );
}
