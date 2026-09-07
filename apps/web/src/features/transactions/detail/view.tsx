'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useId } from 'react';

import { TransactionsApiError } from '../api/client';
import { PollErrorBanner } from '../components/poll-error-banner';
import { apiErrorMessage } from '../presentation';
import { transactionDetailQueryOptions, transactionQueryKeys } from '../queries';
import { isTerminalStatus } from '../reconcile';

import { DetailLoadingSkeleton } from './components/detail-skeleton';
import { TransactionDetail } from './components/transaction-detail';

import { Button } from '@/components/shared/button';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRANSACTION_NOT_FOUND_CODE = 'TRANSACTION_NOT_FOUND';

type TransactionDetailViewProps = {
  backHref: string;
  transactionExternalId: string;
};

type BackLinkProps = {
  href: string;
};

function BackLink({ href }: BackLinkProps) {
  return (
    <Link
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
      href={href}
    >
      ← Voltar
    </Link>
  );
}

type DetailHeaderProps = {
  backHref: string;
  id: string;
};

function DetailHeader({ backHref, id }: DetailHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <BackLink href={backHref} />
      <h1 className="text-[18px] font-semibold text-on-surface">Detalhe da transação</h1>
      <span
        className="tabular rounded-md bg-surface-container px-2 py-0.5 text-[12px] font-medium text-on-surface-variant"
        title={id}
        translate="no"
      >
        #{id.slice(0, 8).toUpperCase()}
      </span>
    </div>
  );
}

function InvalidIdState({ backHref }: { backHref: string }) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref} />
      <section
        aria-labelledby={titleId}
        className="flex flex-col items-start gap-3 rounded-xl border border-surface-container-high bg-surface-container-lowest p-8 shadow-soft"
        role="alert"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-error">
          Identificador inválido
        </p>
        <h1 className="text-[18px] font-semibold text-on-surface" id={titleId}>
          O identificador informado não é válido
        </h1>
        <p className="max-w-lg text-[14px] leading-6 text-on-surface-variant">
          O endereço acessado não corresponde a um identificador de transação válido. Verifique o
          endereço e tente novamente.
        </p>
        <BackLink href={backHref} />
      </section>
    </div>
  );
}

function NotFoundState({ backHref }: { backHref: string }) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref} />
      <section
        aria-labelledby={titleId}
        className="flex flex-col items-start gap-3 rounded-xl border border-surface-container-high bg-surface-container-lowest p-8 shadow-soft"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
          Não encontrada
        </p>
        <h1 className="text-[18px] font-semibold text-on-surface" id={titleId}>
          Transação não encontrada
        </h1>
        <p className="max-w-lg text-[14px] leading-6 text-on-surface-variant">
          {apiErrorMessage(TRANSACTION_NOT_FOUND_CODE)}
        </p>
        <BackLink href={backHref} />
      </section>
    </div>
  );
}

type ErrorStateProps = {
  backHref: string;
  errorMessage: string;
  onRetry(): void;
};

function DetailErrorState({ backHref, errorMessage, onRetry }: ErrorStateProps) {
  const titleId = useId();
  return (
    <div className="flex flex-col gap-6">
      <BackLink href={backHref} />
      <section
        aria-labelledby={titleId}
        className="flex flex-col items-start gap-3 rounded-xl border border-error-container bg-surface-container-lowest p-8 shadow-soft"
        role="alert"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-error">
          Falha na consulta
        </p>
        <h1 className="text-[18px] font-semibold text-on-surface" id={titleId}>
          Não foi possível carregar o detalhe
        </h1>
        <p className="max-w-lg text-[14px] leading-6 text-on-surface-variant">{errorMessage}</p>
        <Button className="h-11 rounded-full px-5" onClick={onRetry} type="button">
          Tentar novamente
        </Button>
      </section>
    </div>
  );
}

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
  const queryClient = useQueryClient();
  const isValidId = UUID_PATTERN.test(transactionExternalId);
  const query = useQuery({
    ...transactionDetailQueryOptions(transactionExternalId),
    enabled: isValidId,
  });
  const decisionVersion =
    query.data && isTerminalStatus(query.data.transactionStatus.name)
      ? `${query.data.transactionExternalId}:${query.data.transactionStatus.name}:${query.data.updatedAt}`
      : undefined;

  useEffect(() => {
    if (!decisionVersion) return;
    queryClient.removeQueries({ queryKey: transactionQueryKeys.lists, type: 'inactive' });
    void queryClient.invalidateQueries({ queryKey: transactionQueryKeys.lists, type: 'active' });
  }, [decisionVersion, queryClient]);

  if (!isValidId) return <InvalidIdState backHref={backHref} />;
  if (query.isLoading && !query.data) return <DetailLoadingSkeleton backHref={backHref} />;
  if (query.isError && !query.data) {
    if (isNotFoundError(query.error)) return <NotFoundState backHref={backHref} />;
    return (
      <DetailErrorState
        backHref={backHref}
        errorMessage={errorMessageFrom(query.error)}
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data) return <DetailLoadingSkeleton backHref={backHref} />;
  const pollError = query.isError ? (
    <PollErrorBanner
      errorMessage={errorMessageFrom(query.error)}
      onRetry={() => void query.refetch()}
    />
  ) : null;
  return (
    <div className="flex flex-col gap-6">
      <DetailHeader backHref={backHref} id={transactionExternalId} />
      {pollError}
      <TransactionDetail transaction={query.data} />
    </div>
  );
}
