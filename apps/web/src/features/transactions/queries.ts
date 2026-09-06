import { queryOptions } from '@tanstack/react-query';

import type { ListQuery } from './contracts';
import { transactionsApi, type TransactionsApi } from './transactions-api';

const TRANSACTIONS_QUERY_KEY = ['transactions'] as const;

export const transactionQueryKeys = {
  all: TRANSACTIONS_QUERY_KEY,
  list(query: ListQuery) {
    return [...TRANSACTIONS_QUERY_KEY, 'list', query] as const;
  },
  detail(id: string) {
    return [...TRANSACTIONS_QUERY_KEY, 'detail', id] as const;
  },
};

export function listTransactionsQueryOptions(
  query: ListQuery,
  api: TransactionsApi = transactionsApi,
) {
  return queryOptions({
    queryKey: transactionQueryKeys.list(query),
    queryFn: ({ signal }) => api.list(query, signal),
  });
}

export function transactionDetailQueryOptions(
  transactionExternalId: string,
  api: TransactionsApi = transactionsApi,
) {
  return queryOptions({
    queryKey: transactionQueryKeys.detail(transactionExternalId),
    queryFn: ({ signal }) => api.get(transactionExternalId, signal),
  });
}
