import { ListContentSkeleton } from './components/list-content-skeleton';
import { TransactionsHeader } from './components/transactions-header';

export function TransactionsListLoadingView() {
  return (
    <div className="flex flex-col gap-6">
      <TransactionsHeader />
      <ListContentSkeleton />
    </div>
  );
}
