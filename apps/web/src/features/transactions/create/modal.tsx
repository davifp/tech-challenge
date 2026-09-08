'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

import { CreateTransactionView } from './view';

function CloseIcon() {
  return (
    <svg
      fill="none"
      height="20"
      stroke="currentColor"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CreateTransactionModal() {
  const router = useRouter();
  const close = useCallback(() => router.back(), [router]);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [close]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        aria-labelledby="modal-title"
        aria-modal="true"
        className="flex w-full max-w-140 flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-2xl"
        role="dialog"
      >
        <div className="flex items-start justify-between border-b border-surface-container-high px-6 pb-4 pt-6">
          <div className="flex flex-col gap-1 pr-4">
            <div className="flex items-center gap-2">
              <h2
                className="text-[22px] font-semibold tracking-tight text-on-surface"
                id="modal-title"
              >
                Nova transação
              </h2>
              <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-on-primary-fixed">
                Manual
              </span>
            </div>
            <p className="text-[13px] text-on-surface-variant">
              Preencha os dados abaixo para registrar uma nova transferência.
            </p>
          </div>
          <button
            aria-label="Fechar modal"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            onClick={close}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <CreateTransactionView onClose={close} />
      </div>
    </div>
  );
}
