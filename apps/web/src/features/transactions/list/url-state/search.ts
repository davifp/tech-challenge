import {
  transactionStatusSchema,
  transactionTypeIdSchema,
  type ListQuery,
  type TransactionStatus,
  type TransactionTypeId,
} from '../../contracts';
import { FIRST_PAGE, PAGE_SIZE } from '../pagination';

import { endOfBrasiliaCivilDayIso, isCivilDate, startOfBrasiliaCivilDayIso } from './date-range';

const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
export const TRANSACTIONS_LIST_PATH = '/transactions';

export type TransactionsSearch = {
  status?: TransactionStatus;
  transferTypeId?: TransactionTypeId;
  from?: string;
  to?: string;
  page: number;
};

type ReadableSearchParams = {
  get(name: string): string | null;
};

function readParam(params: ReadableSearchParams, name: string): string | null {
  const value = params.get(name);
  return value === '' ? null : value;
}

function normalizeStatus(candidate: string | null | undefined): TransactionStatus | undefined {
  if (!candidate) return undefined;
  const parsed = transactionStatusSchema.safeParse(candidate);
  return parsed.success ? parsed.data : undefined;
}

function normalizeTransferTypeId(
  candidate: string | null | undefined,
): TransactionTypeId | undefined {
  if (!candidate) return undefined;
  const parsed = transactionTypeIdSchema.safeParse(Number(candidate));
  return parsed.success ? parsed.data : undefined;
}

function normalizeCivilDate(candidate: string | null | undefined): string | undefined {
  if (!candidate) return undefined;
  return isCivilDate(candidate) ? candidate : undefined;
}

function normalizePage(candidate: string | null | undefined): number {
  if (!candidate || !POSITIVE_INTEGER_PATTERN.test(candidate)) return FIRST_PAGE;
  const parsed = Number(candidate);
  if (!Number.isSafeInteger(parsed)) return FIRST_PAGE;
  return parsed;
}

export function parseTransactionsSearchParams(params: ReadableSearchParams): TransactionsSearch {
  return {
    status: normalizeStatus(readParam(params, 'status')),
    transferTypeId: normalizeTransferTypeId(readParam(params, 'transferTypeId')),
    from: normalizeCivilDate(readParam(params, 'from')),
    to: normalizeCivilDate(readParam(params, 'to')),
    page: normalizePage(readParam(params, 'page')),
  };
}

export function serializeTransactionsSearch(search: TransactionsSearch): URLSearchParams {
  const params = new URLSearchParams();
  if (search.status) params.set('status', search.status);
  if (search.transferTypeId) params.set('transferTypeId', String(search.transferTypeId));
  if (search.from) params.set('from', search.from);
  if (search.to) params.set('to', search.to);
  if (search.page !== FIRST_PAGE) params.set('page', String(search.page));
  return params;
}

export function replaceFilters(
  previous: TransactionsSearch,
  patch: Partial<Pick<TransactionsSearch, 'status' | 'transferTypeId' | 'from' | 'to'>>,
): TransactionsSearch {
  return {
    status: 'status' in patch ? patch.status : previous.status,
    transferTypeId: 'transferTypeId' in patch ? patch.transferTypeId : previous.transferTypeId,
    from: 'from' in patch ? patch.from : previous.from,
    to: 'to' in patch ? patch.to : previous.to,
    page: FIRST_PAGE,
  };
}

export function clearFilters(): TransactionsSearch {
  return { page: FIRST_PAGE };
}

export function changePage(previous: TransactionsSearch, page: number): TransactionsSearch {
  const safePage = page < FIRST_PAGE ? FIRST_PAGE : Math.floor(page);
  return { ...previous, page: safePage };
}

export function hasActiveFilters(search: TransactionsSearch): boolean {
  return Boolean(search.status || search.transferTypeId || search.from || search.to);
}

export function toListQuery(search: TransactionsSearch): ListQuery {
  const query: ListQuery = { page: search.page, limit: PAGE_SIZE };
  if (search.status) query.status = search.status;
  if (search.transferTypeId) query.transferTypeId = search.transferTypeId;
  if (search.from) query.createdAtFrom = startOfBrasiliaCivilDayIso(search.from);
  if (search.to) query.createdAtTo = endOfBrasiliaCivilDayIso(search.to);
  return query;
}

export function buildTransactionsHref(search: TransactionsSearch): string {
  const params = serializeTransactionsSearch(search);
  const suffix = params.toString();
  return suffix ? `${TRANSACTIONS_LIST_PATH}?${suffix}` : TRANSACTIONS_LIST_PATH;
}

export function buildTransactionDetailHref(
  transactionExternalId: string,
  currentSearch: TransactionsSearch,
): string {
  const returnTo = buildTransactionsHref(currentSearch);
  const params = new URLSearchParams();
  if (returnTo !== TRANSACTIONS_LIST_PATH) params.set('returnTo', returnTo);
  const encoded = params.toString();
  const base = `${TRANSACTIONS_LIST_PATH}/${encodeURIComponent(transactionExternalId)}`;
  return encoded ? `${base}?${encoded}` : base;
}

export function sanitizeReturnTo(candidate: string | null | undefined): string {
  if (!candidate || !candidate.startsWith(TRANSACTIONS_LIST_PATH)) return TRANSACTIONS_LIST_PATH;
  const [pathname, queryString = ''] = candidate.split('?');
  if (pathname !== TRANSACTIONS_LIST_PATH) return TRANSACTIONS_LIST_PATH;
  const search = parseTransactionsSearchParams(new URLSearchParams(queryString));
  return buildTransactionsHref(search);
}
