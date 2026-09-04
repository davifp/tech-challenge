import type { ReactNode } from 'react';

export const metadata = {
  title: 'BIUD · Dashboard',
  description: 'Painel operacional de transacoes',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
