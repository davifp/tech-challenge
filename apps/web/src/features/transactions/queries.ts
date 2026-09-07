import { queryOptions } from '@tanstack/react-query';

import { transactionsApi, type TransactionsApi } from './api/client';
import type {
  ListQuery,
  SubmissionAttempt,
  TransactionPage,
  TransactionResponse,
} from './contracts';
import { hasPendingItems, reconcileTransaction, reconcileTransactionPage } from './reconcile';

export const POLL_INTERVAL_MS = 3_000;

const TRANSACTIONS_QUERY_KEY = ['transactions'] as const;
const TRANSACTIONS_LISTS_QUERY_KEY = [...TRANSACTIONS_QUERY_KEY, 'list'] as const;

export const transactionQueryKeys = {
  all: TRANSACTIONS_QUERY_KEY,
  lists: TRANSACTIONS_LISTS_QUERY_KEY,
  list(query: ListQuery) {
    return [...TRANSACTIONS_LISTS_QUERY_KEY, query] as const;
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
    refetchInterval: (q) => {
      const data = q.state.data as TransactionPage | undefined;
      if (!data) return false;
      return hasPendingItems(data) ? POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
    structuralSharing: (prev, next) =>
      reconcileTransactionPage(prev as TransactionPage | undefined, next as TransactionPage),
  });
}

export function transactionDetailQueryOptions(
  transactionExternalId: string,
  api: TransactionsApi = transactionsApi,
) {
  return queryOptions({
    queryKey: transactionQueryKeys.detail(transactionExternalId),
    queryFn: ({ signal }) => api.get(transactionExternalId, signal),
    refetchInterval: (q) => {
      const data = q.state.data as TransactionResponse | undefined;
      if (!data) return false;
      return data.transactionStatus.name === 'pending' ? POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
    structuralSharing: (prev, next) =>
      reconcileTransaction(prev as TransactionResponse | undefined, next as TransactionResponse),
  });
}

export function createTransactionMutationOptions(api: TransactionsApi = transactionsApi) {
  return {
    mutationFn: (attempt: SubmissionAttempt) => api.create(attempt),
  };
}
