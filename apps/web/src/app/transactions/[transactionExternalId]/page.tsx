import { Suspense } from 'react';

import { DetailLoadingSkeleton } from '@/features/transactions/detail/components/detail-skeleton';
import { TransactionDetailView } from '@/features/transactions/detail/transaction-detail-view';
import { sanitizeReturnTo } from '@/features/transactions/list/search-params/transaction-search-params';

type PageProps = {
  params: Promise<{ transactionExternalId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function TransactionDetailPage({ params, searchParams }: PageProps) {
  const { transactionExternalId } = await params;
  const { returnTo } = await searchParams;
  const backHref = sanitizeReturnTo(returnTo);
  return (
    <Suspense fallback={<DetailLoadingSkeleton backHref={backHref} />}>
      <TransactionDetailView backHref={backHref} transactionExternalId={transactionExternalId} />
    </Suspense>
  );
}
