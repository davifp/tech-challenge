import Link from 'next/link';
import type { ReactNode } from 'react';

type DashboardShellProps = {
  children: ReactNode;
};

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface antialiased">
      <a
        className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-primary-container px-4 py-3 text-sm font-semibold text-on-primary shadow-soft focus-visible:translate-y-0"
        href="#conteudo-principal"
      >
        Pular para o conteúdo principal
      </a>
      <header className="sticky top-0 z-30 h-16 border-b border-surface-container-high bg-surface-container-lowest/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-6 sm:px-8">
          <Link className="flex items-center gap-2 rounded-md" href="/">
            <span
              className="text-[22px] font-extrabold tracking-tight text-brand-mark"
              translate="no"
            >
              BIUD
            </span>
            <span className="text-[22px] font-semibold tracking-tight text-on-surface">
              Transações
            </span>
          </Link>
          <p className="hidden text-[13px] font-medium text-on-surface-variant sm:block">
            Painel operacional
          </p>
        </div>
      </header>
      <main
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-8 sm:px-8"
        id="conteudo-principal"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="border-t border-surface-container-high">
        <div className="mx-auto w-full max-w-7xl px-6 py-6 text-[13px] text-on-surface-variant sm:px-8">
          Datas e horários seguem o Horário de Brasília.
        </div>
      </footer>
    </div>
  );
}
