import { Suspense } from 'react';

import { TransactionsListLoadingView } from '@/features/transactions/list/loading-view';
import { TransactionsListView } from '@/features/transactions/list/transactions-list-view';

export default function TransactionsPage() {
  return (
    <Suspense fallback={<TransactionsListLoadingView />}>
      <TransactionsListView />
    </Suspense>
  );
}
