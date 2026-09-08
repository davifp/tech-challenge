'use client';

import { TransactionsApiError } from '../api/transactions-api';
import { PollErrorBanner } from '../components/poll-error-banner';
import { apiErrorMessage } from '../transaction-error-messages';

import { DetailLoadingSkeleton } from './components/detail-skeleton';
import { TransactionDetail } from './components/transaction-detail';
import {
  InvalidTransactionIdState,
  TransactionDetailErrorState,
  TransactionDetailHeader,
  TransactionNotFoundState,
} from './components/transaction-detail-states';
import { useTransactionDetail } from './use-transaction-detail';

const TRANSACTION_NOT_FOUND_CODE = 'TRANSACTION_NOT_FOUND';

type TransactionDetailViewProps = {
  backHref: string;
  transactionExternalId: string;
};

function errorMessageFrom(error: unknown): string {
  if (error instanceof TransactionsApiError) return apiErrorMessage(error.code);
  return apiErrorMessage('INTERNAL_ERROR');
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof TransactionsApiError && error.code === TRANSACTION_NOT_FOUND_CODE;
}

export function TransactionDetailView({
  backHref,
  transactionExternalId,
}: TransactionDetailViewProps) {
  const { isValidId, query } = useTransactionDetail(transactionExternalId);
  if (!isValidId) return <InvalidTransactionIdState backHref={backHref} />;
  if (query.isLoading && !query.data) return <DetailLoadingSkeleton backHref={backHref} />;
  if (query.isError && !query.data) {
    if (isNotFoundError(query.error)) return <TransactionNotFoundState backHref={backHref} />;
    return (
      <TransactionDetailErrorState
        backHref={backHref}
        errorMessage={errorMessageFrom(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) return <DetailLoadingSkeleton backHref={backHref} />;
  return (
    <div className="flex flex-col gap-6">
      <TransactionDetailHeader backHref={backHref} id={transactionExternalId} />
      {query.isError ? (
        <PollErrorBanner
          errorMessage={errorMessageFrom(query.error)}
          onRetry={() => void query.refetch()}
        />
      ) : null}
      <TransactionDetail transaction={query.data} />
    </div>
  );
}
