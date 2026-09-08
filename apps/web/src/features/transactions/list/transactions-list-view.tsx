'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo } from 'react';

import { listTransactionsQueryOptions } from '../transaction-query-options';

import { TransactionsFilters } from './components/transactions-filters';
import { TransactionsHeader } from './components/transactions-header';
import { TransactionsListContent } from './components/transactions-list-content';
import { totalPages } from './pagination';
import { validateCivilDateRange } from './search-params/date-range';
import {
  buildTransactionsHref,
  changePage,
  clearFilters,
  parseTransactionSearchParams,
  replaceFilters,
  toListQuery,
  type TransactionSearchParams,
} from './search-params/transaction-search-params';

export function TransactionsListView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearchParams = searchParams.toString();
  const currentSearch = useMemo<TransactionSearchParams>(
    () => parseTransactionSearchParams(new URLSearchParams(serializedSearchParams)),
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
  function navigate(nextSearch: TransactionSearchParams) {
    router.push(buildTransactionsHref(nextSearch), { scroll: false });
  }
  function applyFilters(
    filters: Pick<TransactionSearchParams, 'status' | 'transferTypeId' | 'from' | 'to'>,
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
      {rangeValidation.ok ? (
        <TransactionsListContent
          currentSearch={currentSearch}
          onChangePage={(page) => navigate(changePage(currentSearch, page))}
          onClearFilters={clearSearch}
          query={queryResult}
        />
      ) : null}
    </div>
  );
}
