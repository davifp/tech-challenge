import type { ReactNode } from 'react';

import { Providers } from './providers';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import '@/styles/globals.css';

export const metadata = {
  title: 'BIUD · Dashboard',
  description: 'Painel operacional de transações',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <head>
        <meta content="#fbf9fb" name="theme-color" />
      </head>
      <body>
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
