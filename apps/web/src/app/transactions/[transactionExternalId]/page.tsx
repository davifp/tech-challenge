import { Suspense } from 'react';

import { DetailLoadingSkeleton } from '@/features/transactions/detail/components/detail-skeleton';
import { TransactionDetailView } from '@/features/transactions/detail/view';
import { sanitizeReturnTo } from '@/features/transactions/list/url-state/search';

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
