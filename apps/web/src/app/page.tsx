import { redirect } from 'next/navigation';

import { TRANSACTIONS_LIST_PATH } from '@/features/transactions/list/url-state/search';

export default function RootPage(): never {
  redirect(TRANSACTIONS_LIST_PATH);
}
