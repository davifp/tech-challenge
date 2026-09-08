import Link from 'next/link';
import { useId } from 'react';

import { apiErrorMessage } from '../../transaction-error-messages';

import { Button } from '@/components/ui/button';

const TRANSACTION_NOT_FOUND_CODE = 'TRANSACTION_NOT_FOUND';

type BackLinkProps = {
  href: string;
};

export function BackLink({ href }: BackLinkProps) {
  return (
    <Link
      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
      href={href}
    >
      ← Voltar
    </Link>
  );
}

export function TransactionDetailHeader({ backHref, id }: { backHref: string; id: string }) {
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

export function InvalidTransactionIdState({ backHref }: { backHref: string }) {
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

export function TransactionNotFoundState({ backHref }: { backHref: string }) {
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

type TransactionDetailErrorStateProps = {
  backHref: string;
  errorMessage: string;
  onRetry(): void;
};

export function TransactionDetailErrorState({
  backHref,
  errorMessage,
  onRetry,
}: TransactionDetailErrorStateProps) {
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
