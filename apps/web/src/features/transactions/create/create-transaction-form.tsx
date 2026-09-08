'use client';

import Link from 'next/link';
import { type ChangeEvent, type KeyboardEvent, useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { FormField } from './components/form-field';
import type {
  CreateTransactionFormInput,
  CreateTransactionFormOutput,
} from './create-transaction-form-schema';
import { isAllowedMoneyKey, normalizeMoneyInput } from './money-input';

import { Button } from '@/components/ui/button';

type CreateTransactionFormProps = {
  form: UseFormReturn<CreateTransactionFormInput, unknown, CreateTransactionFormOutput>;
  generalError: string | null;
  isPending: boolean;
  onClose?(): void;
  onSubmit(formData: CreateTransactionFormOutput): void;
};

const INPUT_CLASS_NAME =
  'h-12 rounded-xl bg-surface-container-low px-4 text-[14px] text-on-surface placeholder:text-on-surface-variant/60 focus:bg-surface-container-lowest focus:outline-2 focus:outline-primary-container disabled:opacity-50';

export function CreateTransactionForm({
  form,
  generalError,
  isPending,
  onClose,
  onSubmit,
}: CreateTransactionFormProps) {
  const baseId = useId();
  const debitId = `${baseId}-debit`;
  const creditId = `${baseId}-credit`;
  const typeId = `${baseId}-transfer-type`;
  const valueId = `${baseId}-value`;
  const debitErrorId = `${debitId}-error`;
  const creditErrorId = `${creditId}-error`;
  const typeErrorId = `${typeId}-error`;
  const valueErrorId = `${valueId}-error`;
  const valueField = form.register('value');
  const { errors } = form.formState;
  function handleValueChange(event: ChangeEvent<HTMLInputElement>) {
    event.target.value = normalizeMoneyInput(event.target.value);
    void valueField.onChange(event);
  }
  function handleValueKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isAllowedMoneyKey(event)) event.preventDefault();
  }
  return (
    <form
      aria-label="Formulário de nova transação"
      className="flex flex-col gap-5 p-6"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      {generalError ? (
        <div
          className="rounded-xl border border-error-container bg-error-container/20 px-4 py-3"
          role="alert"
        >
          <p className="text-[13px] text-error">{generalError}</p>
        </div>
      ) : null}
      <FormField
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
          className={INPUT_CLASS_NAME}
          disabled={isPending}
          id={debitId}
          placeholder="UUID da conta de débito…"
          spellCheck={false}
          type="text"
          {...form.register('accountExternalIdDebit')}
        />
      </FormField>
      <FormField
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
          className={INPUT_CLASS_NAME}
          disabled={isPending}
          id={creditId}
          placeholder="UUID da conta de crédito…"
          spellCheck={false}
          type="text"
          {...form.register('accountExternalIdCredit')}
        />
      </FormField>
      <FormField
        error={errors.transferTypeId?.message}
        errorId={typeErrorId}
        htmlFor={typeId}
        label="Tipo de transferência"
      >
        <select
          aria-describedby={errors.transferTypeId ? typeErrorId : undefined}
          aria-invalid={errors.transferTypeId ? 'true' : 'false'}
          aria-required="true"
          className={INPUT_CLASS_NAME}
          disabled={isPending}
          id={typeId}
          {...form.register('transferTypeId')}
        >
          <option value="">Selecione o tipo…</option>
          <option value="1">Pix</option>
          <option value="2">TED</option>
          <option value="3">Book Transfer</option>
        </select>
      </FormField>
      <FormField
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
            className={`${INPUT_CLASS_NAME} w-full pl-10 pr-4`}
            disabled={isPending}
            id={valueId}
            inputMode="decimal"
            placeholder="0,00…"
            type="text"
            {...valueField}
            onChange={handleValueChange}
            onKeyDown={handleValueKeyDown}
          />
        </div>
      </FormField>
      <div className="flex items-center justify-end gap-3 border-t border-surface-container-high pt-5">
        {onClose ? (
          <Button className="h-11 rounded-xl px-5" onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
        ) : (
          <Link
            className="inline-flex h-11 cursor-pointer items-center rounded-xl px-5 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            href="/transactions"
          >
            Cancelar
          </Link>
        )}
        <button
          className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-primary-container px-6 text-[13px] font-semibold text-on-primary shadow-soft hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
          type="submit"
        >
          {isPending ? 'Enviando...' : 'Criar transação'}
        </button>
      </div>
    </form>
  );
}
