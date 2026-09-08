'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import type { TransactionStatus, TransactionTypeId } from '../../contracts';
import { validateCivilDateRange, type CivilDateRangeError } from '../url-state/date-range';
import { hasActiveFilters, type TransactionsSearch } from '../url-state/search';

import { Button } from '@/components/shared/button';
import { IconFilter } from '@/components/shared/icons';

type TransactionsFiltersProps = {
  current: TransactionsSearch;
  onApply(patch: Pick<TransactionsSearch, 'status' | 'transferTypeId' | 'from' | 'to'>): void;
  onClear(): void;
};

type FiltersFormState = {
  status: TransactionStatus | '';
  transferTypeId: TransactionTypeId | '';
  from: string;
  to: string;
};

const STATUS_OPTIONS: ReadonlyArray<{ value: TransactionStatus; label: string }> = [
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
];

const TYPE_OPTIONS: ReadonlyArray<{ value: TransactionTypeId; label: string }> = [
  { value: 1, label: 'Pix' },
  { value: 2, label: 'TED' },
  { value: 3, label: 'Book Transfer' },
];

const RANGE_ERROR_MESSAGES: Record<CivilDateRangeError, string> = {
  'invalid-from': 'Informe uma data inicial válida.',
  'invalid-to': 'Informe uma data final válida.',
  'inverted-range': 'A data final deve ser igual ou posterior à data inicial.',
};

const INPUT_BASE =
  'h-11 rounded-xl bg-surface-container-low px-3 text-[14px] text-on-surface placeholder:text-on-surface-variant focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary-container/60 transition-colors';

function buildFormState(current: TransactionsSearch): FiltersFormState {
  return {
    status: current.status ?? '',
    transferTypeId: current.transferTypeId ?? '',
    from: current.from ?? '',
    to: current.to ?? '',
  };
}

function rangeErrorFrom(current: TransactionsSearch): CivilDateRangeError | null {
  const validation = validateCivilDateRange({ from: current.from, to: current.to });
  return validation.ok ? null : validation.reason;
}

export function TransactionsFilters({ current, onApply, onClear }: TransactionsFiltersProps) {
  const [formState, setFormState] = useState<FiltersFormState>(() => buildFormState(current));
  const [rangeError, setRangeError] = useState<CivilDateRangeError | null>(() =>
    rangeErrorFrom(current),
  );
  const rangeErrorId = useId();
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFormState(buildFormState(current));
    setRangeError(rangeErrorFrom(current));
  }, [current]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = formState.from || undefined;
    const to = formState.to || undefined;
    const validation = validateCivilDateRange({ from, to });
    if (!validation.ok) {
      setRangeError(validation.reason);
      const invalidInput = validation.reason === 'invalid-to' ? toInputRef : fromInputRef;
      invalidInput.current?.focus();
      return;
    }
    setRangeError(null);
    onApply({
      status: formState.status || undefined,
      transferTypeId: formState.transferTypeId || undefined,
      from,
      to,
    });
  }

  function handleClear() {
    setRangeError(null);
    setFormState({ status: '', transferTypeId: '', from: '', to: '' });
    onClear();
  }

  const filtersActive = hasActiveFilters(current);
  return (
    <form
      aria-label="Filtros da listagem de transações"
      className="rounded-xl border border-surface-container-high/60 bg-surface-container-lowest p-4 shadow-soft sm:p-5"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="grid gap-3 md:grid-cols-12 md:items-end">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-on-surface-variant md:col-span-3">
          Status
          <select
            autoComplete="off"
            className={INPUT_BASE}
            name="status"
            onChange={(event) =>
              setFormState((previous) => ({
                ...previous,
                status: (event.target.value || '') as TransactionStatus | '',
              }))
            }
            value={formState.status}
          >
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-on-surface-variant md:col-span-3">
          Tipo de transferência
          <select
            autoComplete="off"
            className={INPUT_BASE}
            name="transferTypeId"
            onChange={(event) =>
              setFormState((previous) => ({
                ...previous,
                transferTypeId:
                  event.target.value === ''
                    ? ''
                    : (Number(event.target.value) as TransactionTypeId),
              }))
            }
            value={formState.transferTypeId}
          >
            <option value="">Todos os tipos</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-on-surface-variant md:col-span-2">
          Início (Horário de Brasília)
          <input
            aria-describedby={rangeError ? rangeErrorId : undefined}
            aria-invalid={rangeError === 'invalid-from' || rangeError === 'inverted-range'}
            autoComplete="off"
            className={INPUT_BASE}
            name="from"
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, from: event.target.value }))
            }
            ref={fromInputRef}
            type="date"
            value={formState.from}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-on-surface-variant md:col-span-2">
          Fim (Horário de Brasília)
          <input
            aria-describedby={rangeError ? rangeErrorId : undefined}
            aria-invalid={rangeError === 'invalid-to' || rangeError === 'inverted-range'}
            autoComplete="off"
            className={INPUT_BASE}
            name="to"
            onChange={(event) =>
              setFormState((previous) => ({ ...previous, to: event.target.value }))
            }
            ref={toInputRef}
            type="date"
            value={formState.to}
          />
        </label>
        <div className="flex items-center gap-2 md:col-span-2 md:justify-end">
          <Button className="h-11 rounded-full px-4" type="submit">
            <IconFilter className="h-4 w-4" />
            Aplicar
          </Button>
          {filtersActive && (
            <Button
              className="h-11 rounded-full px-3"
              onClick={handleClear}
              type="button"
              variant="ghost"
            >
              Limpar
            </Button>
          )}
        </div>
      </div>
      {rangeError && (
        <p className="mt-3 text-[13px] font-medium text-error" id={rangeErrorId} role="alert">
          {RANGE_ERROR_MESSAGES[rangeError]}
        </p>
      )}
    </form>
  );
}
