import type { ReactNode } from 'react';

type TransactionsLayoutProps = {
  children: ReactNode;
  modal: ReactNode;
};

export default function TransactionsLayout({ children, modal }: TransactionsLayoutProps) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
