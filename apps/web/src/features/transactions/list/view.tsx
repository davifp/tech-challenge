'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { TransactionsApiError } from '../api/client';
import { EmptyState } from '../components/empty-state';
import { ErrorState } from '../components/error-state';
import { PollErrorBanner } from '../components/poll-error-banner';
import type { TransactionPage } from '../contracts';
import { apiErrorMessage } from '../presentation';
import { listTransactionsQueryOptions } from '../queries';

import { ListContentSkeleton } from './components/list-content-skeleton';
import { PaginationBar } from './components/pagination-bar';
import { TransactionsFilters } from './components/transactions-filters';
import { TransactionsHeader } from './components/transactions-header';
import { TransactionsList } from './components/transactions-list';
import { totalPages } from './pagination';
import { validateCivilDateRange } from './url-state/date-range';
import {
  buildTransactionsHref,
  changePage,
  clearFilters,
  hasActiveFilters,
  parseTransactionsSearchParams,
  replaceFilters,
  toListQuery,
  type TransactionsSearch,
} from './url-state/search';

type TransactionsListQueryResult = UseQueryResult<TransactionPage, unknown>;

type ContentSectionProps = {
  currentSearch: TransactionsSearch;
  onChangePage(page: number): void;
  onClearFilters(): void;
  query: TransactionsListQueryResult;
};

function errorMessageFrom(error: unknown): string {
  if (error instanceof TransactionsApiError) return apiErrorMessage(error.code);
  return apiErrorMessage('INTERNAL_ERROR');
}

export function TransactionsListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const currentSearch = useMemo<TransactionsSearch>(
    () => parseTransactionsSearchParams(new URLSearchParams(serializedSearchParams)),
    [serializedSearchParams],
  );
  const rangeValidation = validateCivilDateRange({
    from: currentSearch.from,
    to: currentSearch.to,
  });
  const queryResult = useQuery({
    ...listTransactionsQueryOptions(toListQuery(currentSearch)),
    enabled: rangeValidation.ok,
  });
  const lastPage = queryResult.data ? totalPages(queryResult.data.total) : undefined;
  const canonicalHref =
    rangeValidation.ok && lastPage !== undefined && currentSearch.page > lastPage
      ? buildTransactionsHref(changePage(currentSearch, lastPage))
      : undefined;

  useEffect(() => {
    if (canonicalHref) router.replace(canonicalHref, { scroll: false });
  }, [canonicalHref, router]);

  function navigate(nextSearch: TransactionsSearch) {
    router.push(buildTransactionsHref(nextSearch), { scroll: false });
  }

  function applyFilters(
    filters: Pick<TransactionsSearch, 'status' | 'transferTypeId' | 'from' | 'to'>,
  ) {
    navigate(replaceFilters(currentSearch, filters));
  }

  function clearSearch() {
    navigate(clearFilters());
  }

  return (
    <div className="flex flex-col gap-6">
      <TransactionsHeader />
      <TransactionsFilters current={currentSearch} onApply={applyFilters} onClear={clearSearch} />
      {rangeValidation.ok && (
        <ContentSection
          currentSearch={currentSearch}
          onChangePage={(page) => navigate(changePage(currentSearch, page))}
          onClearFilters={clearSearch}
          query={queryResult}
        />
      )}
    </div>
  );
}

function ContentSection({
  currentSearch,
  onChangePage,
  onClearFilters,
  query,
}: ContentSectionProps) {
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
