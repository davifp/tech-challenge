'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';

import { TransactionsApiError } from '../api/transactions-api';
import { apiErrorMessage, apiFieldErrorMessage } from '../transaction-error-messages';
import {
  createTransactionMutationOptions,
  transactionQueryKeys,
} from '../transaction-query-options';
import type { ApiErrorDetail, SubmissionAttempt } from '../transaction-schemas';

import {
  createTransactionFormSchema,
  type CreateTransactionFormInput,
  type CreateTransactionFormOutput,
} from './create-transaction-form-schema';
import { formatValueForInput } from './money-input';
import { clearAttempt, loadAttempt, saveAttempt } from './submission-attempt-storage';

const FORM_FIELD_PATHS = new Set<keyof CreateTransactionFormInput>([
  'accountExternalIdDebit',
  'accountExternalIdCredit',
  'transferTypeId',
  'value',
]);

type TransactionForm = UseFormReturn<
  CreateTransactionFormInput,
  unknown,
  CreateTransactionFormOutput
>;

function isUncertainError(error: TransactionsApiError): boolean {
  return (
    error.code === 'NETWORK_ERROR' ||
    error.code === 'TIMEOUT' ||
    (error.status !== undefined && error.status >= 500)
  );
}

function isFormFieldPath(path: string): path is keyof CreateTransactionFormInput {
  return FORM_FIELD_PATHS.has(path as keyof CreateTransactionFormInput);
}

function applyFieldErrors(form: TransactionForm, details: ApiErrorDetail[]): string | null {
  const generalDetails: string[] = [];
  details.forEach((detail) => {
    if (isFormFieldPath(detail.path)) {
      form.setError(detail.path, { type: 'server', message: apiFieldErrorMessage(detail) });
      return;
    }
    generalDetails.push(apiFieldErrorMessage(detail));
  });
  return generalDetails.length > 0 ? generalDetails.join(' ') : null;
}

export function useCreateTransaction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [recoveryAttempt, setRecoveryAttempt] = useState<SubmissionAttempt | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const form = useForm<CreateTransactionFormInput, unknown, CreateTransactionFormOutput>({
    resolver: zodResolver(createTransactionFormSchema),
    defaultValues: {
      accountExternalIdDebit: '',
      accountExternalIdCredit: '',
      transferTypeId: '',
      value: '',
    },
  });
  const mutation = useMutation({
    ...createTransactionMutationOptions(),
    onSuccess(response) {
      clearAttempt();
      setRecoveryAttempt(null);
      queryClient.setQueryData(
        transactionQueryKeys.detail(response.transactionExternalId),
        response,
      );
      void queryClient.invalidateQueries({ queryKey: transactionQueryKeys.lists });
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
        setGeneralError(applyFieldErrors(form, error.details));
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
      transferTypeId: String(stored.body.transferTypeId),
      value: formatValueForInput(stored.body.value),
    });
  }, [form]);
  function submitAttempt(attempt: SubmissionAttempt) {
    setGeneralError(null);
    saveAttempt({ ...attempt, state: 'sending' });
    mutation.mutate(attempt);
  }
  function submit(formData: CreateTransactionFormOutput) {
    setRecoveryAttempt(null);
    submitAttempt({ key: crypto.randomUUID(), body: formData, state: 'sending' });
  }
  function replay() {
    if (recoveryAttempt) submitAttempt(recoveryAttempt);
  }
  function startNewAttempt() {
    clearAttempt();
    setRecoveryAttempt(null);
    setGeneralError(null);
  }
  return {
    form,
    generalError,
    isPending: mutation.isPending,
    recoveryAttempt,
    replay,
    startNewAttempt,
    submit,
  };
}
