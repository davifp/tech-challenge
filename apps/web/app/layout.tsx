import type { ReactNode } from 'react';

import { DashboardShell } from './dashboard-shell';
import './globals.css';
import { Providers } from './providers';

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
        <meta content="#f4f7fb" name="theme-color" />
      </head>
      <body>
        <Providers>
          <DashboardShell>{children}</DashboardShell>
        </Providers>
      </body>
    </html>
  );
}
