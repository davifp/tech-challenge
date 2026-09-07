'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { TransactionsApiError } from '../api/client';
import type { CreateTransactionInput, SubmissionAttempt } from '../contracts';
import { apiErrorMessage, apiFieldErrorMessage } from '../presentation';
import { createTransactionMutationOptions, transactionQueryKeys } from '../queries';
import { clearAttempt, loadAttempt, saveAttempt } from '../submission-attempt';

import {
  createTransactionFormSchema,
  type CreateTransactionFormInput,
  type CreateTransactionFormOutput,
} from './form-schema';

const TRANSFER_TYPE_ID = 1 as const;

const VALUE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatValueForInput(value: number): string {
  return VALUE_FORMATTER.format(value);
}

function isUncertainError(error: TransactionsApiError): boolean {
  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT' ||
    (error.status !== undefined && error.status >= 500)
  );
}

const FORM_FIELD_PATHS = new Set(['accountExternalIdDebit', 'accountExternalIdCredit', 'value']);

type RecoveryBannerProps = { onReplay(): void; onNewAttempt(): void; isPending: boolean };

function RecoveryBanner({ onReplay, onNewAttempt, isPending }: RecoveryBannerProps) {
  return (
    <section
      aria-label="Tentativa anterior com resultado incerto"
      className="rounded-xl border border-error-container bg-error-container/20 p-4"
    >
      <p className="mb-1 text-[13px] font-semibold text-error">Resultado desconhecido</p>
      <p className="mb-3 text-[13px] text-on-surface-variant">
        A confirmação da tentativa anterior não foi recebida. Os dados foram preservados. Retome
        para verificar se a transação já foi criada.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="h-9 rounded-full bg-primary-container px-4 text-[13px] font-semibold text-on-primary disabled:opacity-50"
          disabled={isPending}
          onClick={onReplay}
          type="button"
        >
          {isPending ? 'Enviando...' : 'Retomar tentativa'}
        </button>
        <button
          className="h-9 rounded-full border border-outline-variant px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low disabled:opacity-50"
          disabled={isPending}
          onClick={onNewAttempt}
          type="button"
        >
          Nova tentativa
        </button>
      </div>
    </section>
  );
}

type FieldGroupProps = {
  label: string;
  htmlFor: string;
  error?: string;
  errorId: string;
  children: ReactNode;
};

function FieldGroup({ label, htmlFor, error, errorId, children }: FieldGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-on-surface" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-[12px] text-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export type CreateTransactionViewProps = {
  onClose?(): void;
};

export function CreateTransactionView({ onClose }: CreateTransactionViewProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const baseId = useId();
  const debitId = `${baseId}-debit`;
  const creditId = `${baseId}-credit`;
  const valueId = `${baseId}-value`;
  const debitErrorId = `${debitId}-error`;
  const creditErrorId = `${creditId}-error`;
  const valueErrorId = `${valueId}-error`;
  const [recoveryAttempt, setRecoveryAttempt] = useState<SubmissionAttempt | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<CreateTransactionFormInput, unknown, CreateTransactionFormOutput>({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues: { accountExternalIdDebit: '', accountExternalIdCredit: '', value: '' },
  });
  const { errors } = form.formState;
  const mutation = useMutation({
    ...createTransactionMutationOptions(),
    onSuccess(response) {
      clearAttempt();
      setRecoveryAttempt(null);
      queryClient.setQueryData(
        transactionQueryKeys.detail(response.transactionExternalId),
        response,
      );
      void queryClient.invalidateQueries({ queryKey: [...transactionQueryKeys.all, 'list'] });
      router.push(`/transactions/${response.transactionExternalId}?returnTo=/transactions`);
    },
    onError(error, variables) {
      if (!(error instanceof TransactionsApiError)) {
        clearAttempt();
        setGeneralError(apiErrorMessage('INTERNAL_ERROR'));
        return;
      }
      if (isUncertainError(error)) {
        const uncertain: SubmissionAttempt = { ...variables, state: 'uncertain' };
        saveAttempt(uncertain);
        setRecoveryAttempt(uncertain);
        return;
      }
      clearAttempt();
      if (error.code === 'VALIDATION_ERROR' && error.details.length > 0) {
        const generalDetails: string[] = [];
        error.details.forEach((detail) => {
          if (FORM_FIELD_PATHS.has(detail.path)) {
            form.setError(detail.path as keyof CreateTransactionFormInput, {
              type: 'server',
              message: apiFieldErrorMessage(detail),
            });
          } else {
            generalDetails.push(apiFieldErrorMessage(detail));
          }
        });
        if (generalDetails.length > 0) setGeneralError(generalDetails.join(' '));
        return;
      }
      setGeneralError(apiErrorMessage(error.code));
    },
  });
  useEffect(() => {
    const stored = loadAttempt();
    if (!stored) return;
    setRecoveryAttempt(stored);
    form.reset({
      accountExternalIdDebit: stored.body.accountExternalIdDebit,
      accountExternalIdCredit: stored.body.accountExternalIdCredit,
      value: formatValueForInput(stored.body.value),
    });
  }, []);
  function submitAttempt(attempt: SubmissionAttempt) {
    setGeneralError(null);
    saveAttempt({ ...attempt, state: 'sending' });
    mutation.mutate(attempt);
  }
  function handleFormSubmit(formData: CreateTransactionFormOutput) {
    setRecoveryAttempt(null);
    const body: CreateTransactionInput = { ...formData, transferTypeId: TRANSFER_TYPE_ID };
    submitAttempt({ key: crypto.randomUUID(), body, state: 'sending' });
  }
  function handleReplay() {
    if (!recoveryAttempt) return;
    submitAttempt(recoveryAttempt);
  }
  function handleNewAttempt() {
    clearAttempt();
    setRecoveryAttempt(null);
    setGeneralError(null);
  }
  const recovery = recoveryAttempt && (
    <div className="border-b border-surface-container-high p-6">
      <RecoveryBanner
        isPending={mutation.isPending}
        onNewAttempt={handleNewAttempt}
        onReplay={handleReplay}
      />
    </div>
  );
  const formBody = (
    <form
      aria-label="Formulário de nova transação"
      className="flex flex-col gap-5 p-6"
      noValidate
      onSubmit={form.handleSubmit(handleFormSubmit)}
    >
      {generalError && (
        <div
          className="rounded-xl border border-error-container bg-error-container/20 px-4 py-3"
          role="alert"
        >
          <p className="text-[13px] text-error">{generalError}</p>
        </div>
      )}
      <FieldGroup
        error={errors.accountExternalIdDebit?.message}
        errorId={debitErrorId}
        htmlFor={debitId}
        label="Conta de débito"
      >
        <input
          aria-describedby={errors.accountExternalIdDebit ? debitErrorId : undefined}
          aria-invalid={errors.accountExternalIdDebit ? 'true' : 'false'}
          aria-required="true"
          autoComplete="off"
          className="h-12 rounded-xl bg-surface-container-low px-4 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:outline-2 focus:outline-primary-container disabled:opacity-50"
          disabled={mutation.isPending}
          id={debitId}
          placeholder="UUID da conta de débito…"
          spellCheck={false}
          type="text"
          {...form.register('accountExternalIdDebit')}
        />
      </FieldGroup>
      <FieldGroup
        error={errors.accountExternalIdCredit?.message}
        errorId={creditErrorId}
        htmlFor={creditId}
        label="Conta de crédito"
      >
        <input
          aria-describedby={errors.accountExternalIdCredit ? creditErrorId : undefined}
          aria-invalid={errors.accountExternalIdCredit ? 'true' : 'false'}
          aria-required="true"
          autoComplete="off"
          className="h-12 rounded-xl bg-surface-container-low px-4 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:outline-2 focus:outline-primary-container disabled:opacity-50"
          disabled={mutation.isPending}
          id={creditId}
          placeholder="UUID da conta de crédito…"
          spellCheck={false}
          type="text"
          {...form.register('accountExternalIdCredit')}
        />
      </FieldGroup>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-on-surface">Tipo de transferência</span>
        <div className="flex h-12 items-center rounded-xl bg-surface-container px-4 text-[14px] text-on-surface-variant">
          Transferência
        </div>
      </div>
      <FieldGroup
        error={errors.value?.message}
        errorId={valueErrorId}
        htmlFor={valueId}
        label="Valor"
      >
        <div className="relative">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-on-surface-variant">
            R$
          </span>
          <input
            aria-describedby={errors.value ? valueErrorId : undefined}
            aria-invalid={errors.value ? 'true' : 'false'}
            aria-required="true"
            autoComplete="off"
            className="h-12 w-full rounded-xl bg-surface-container-low pl-10 pr-4 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:outline-2 focus:outline-primary-container disabled:opacity-50"
            disabled={mutation.isPending}
            id={valueId}
            inputMode="decimal"
            placeholder="0,00…"
            type="text"
            {...form.register('value')}
          />
        </div>
      </FieldGroup>
      <div className="flex items-center justify-end gap-3 border-t border-surface-container-high pt-5">
        {onClose ? (
          <button
            className="inline-flex h-11 items-center rounded-xl px-5 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
        ) : (
          <Link
            className="inline-flex h-11 items-center rounded-xl px-5 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            href="/transactions"
          >
            Cancelar
          </Link>
        )}
        <button
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary-container px-6 text-[13px] font-semibold text-on-primary shadow-soft hover:brightness-110 disabled:opacity-50"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? 'Enviando...' : 'Criar transação'}
        </button>
      </div>
    </form>
  );
  if (onClose) {
    return (
      <>
        {recovery}
        {formBody}
      </>
    );
  }
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Link
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          href="/transactions"
        >
          ← Transações
        </Link>
        <h1 className="text-[18px] font-semibold text-on-surface">Nova transação</h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-surface-container-high bg-surface-container-lowest shadow-soft">
        {recovery}
        {formBody}
      </div>
    </div>
  );
}
