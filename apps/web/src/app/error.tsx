'use client';

import { useEffect } from 'react';

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Falha inesperada de renderização', { digest: error.digest });
  }, [error.digest]);
  return (
    <section
      aria-labelledby="unexpected-error-title"
      className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8"
      role="alert"
    >
      <p className="text-sm font-bold uppercase tracking-[0.14em] text-red-700">Falha inesperada</p>
      <h1
        className="mt-2 text-pretty text-2xl font-bold text-slate-950"
        id="unexpected-error-title"
      >
        Não foi possível exibir esta página
      </h1>
      <p className="mt-3 max-w-2xl leading-7 text-slate-600">
        Tente carregar o conteúdo novamente. Se a falha continuar, volte mais tarde.
      </p>
      <button
        className="mt-6 min-h-11 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 active:bg-blue-900"
        onClick={reset}
        type="button"
      >
        Tentar novamente
      </button>
    </section>
  );
}
