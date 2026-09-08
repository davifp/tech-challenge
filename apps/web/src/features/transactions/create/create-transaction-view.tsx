'use client';

import Link from 'next/link';

import { RecoveryBanner } from './components/recovery-banner';
import { CreateTransactionForm } from './create-transaction-form';
import { useCreateTransaction } from './use-create-transaction';

export type CreateTransactionViewProps = {
  onClose?(): void;
};

export function CreateTransactionView({ onClose }: CreateTransactionViewProps) {
  const transaction = useCreateTransaction();
  const recovery = transaction.recoveryAttempt ? (
    <div className="border-b border-surface-container-high p-6">
      <RecoveryBanner
        isPending={transaction.isPending}
        onNewAttempt={transaction.startNewAttempt}
        onReplay={transaction.replay}
      />
    </div>
  ) : null;
  const form = (
    <CreateTransactionForm
      form={transaction.form}
      generalError={transaction.generalError}
      isPending={transaction.isPending}
      onClose={onClose}
      onSubmit={transaction.submit}
    />
  );
  if (onClose) {
    return (
      <>
        {recovery}
        {form}
      </>
    );
  }
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center gap-4">
        <Link
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-4 text-[13px] font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          href="/transactions"
        >
          ← Transações
        </Link>
        <h1 className="text-[18px] font-semibold text-on-surface">Nova transação</h1>
      </div>
      <div className="overflow-hidden rounded-2xl border border-surface-container-high bg-surface-container-lowest shadow-soft">
        {recovery}
        {form}
      </div>
    </div>
  );
}
