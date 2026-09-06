import Link from 'next/link';
import type { ReactNode } from 'react';

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white shadow-lg focus-visible:translate-y-0"
        href="#conteudo-principal"
      >
        Pular para o conteúdo principal
      </a>
      <header className="border-b border-slate-200/90 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link
            className="rounded-md text-lg font-bold tracking-tight text-slate-950 hover:text-blue-700"
            href="/"
          >
            <span translate="no">BIUD</span>{' '}
            <span className="font-medium text-blue-700">Transações</span>
          </Link>
          <p className="text-right text-xs font-medium text-slate-500 sm:text-sm">
            Painel operacional
          </p>
        </div>
      </header>
      <main
        className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12"
        id="conteudo-principal"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 pb-8 text-sm text-slate-500 sm:px-8">
        Datas e horários seguem o Horário de Brasília.
      </footer>
    </div>
  );
}
