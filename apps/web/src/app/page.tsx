import { redirect } from 'next/navigation';

import { TRANSACTIONS_LIST_PATH } from '@/features/transactions/list/search-params/transaction-search-params';

export default function RootPage(): never {
  redirect(TRANSACTIONS_LIST_PATH);
}
