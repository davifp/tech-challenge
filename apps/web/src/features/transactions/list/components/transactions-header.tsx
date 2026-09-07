import Link from 'next/link';

import { IconPlus } from '@/components/shared/icons';

export function TransactionsHeader() {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-semibold tracking-tight text-on-surface">Transações</h1>
          <span className="inline-flex items-center rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-fixed">
            Live Feed
          </span>
        </div>
        <p className="max-w-2xl text-[14px] text-on-surface-variant">
          Gerencie e acompanhe as transferências enquanto a decisão antifraude é registrada.
        </p>
      </div>
      <Link
        aria-label="Registrar nova transação"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary-container px-6 text-[15px] font-semibold text-on-primary shadow-soft transition-colors hover:bg-primary focus-visible:bg-primary"
        href="/transactions/new"
      >
        <IconPlus className="h-5 w-5" />
        Nova transação
      </Link>
    </div>
  );
}
