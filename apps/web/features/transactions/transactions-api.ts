import type { z } from 'zod';

import {
  transactionPageSchema,
  transactionResponseSchema,
  type ListQuery,
  type SubmissionAttempt,
  type TransactionPage,
  type TransactionResponse,
} from './contracts';
import {
  createTransactionsApiObservability,
  type TransactionsApiObservability,
  type TransactionsApiOperation,
} from './transactions-api-observability';
import {
  mapTransportError,
  parseSuccessfulResponse,
  readJson,
  throwApiError,
  TransactionsApiError,
} from './transactions-api-response';

export { TransactionsApiError };

export const REQUEST_TIMEOUT_MS = 10_000;

const TRANSACTIONS_API_PATH = '/transactions';
const CONTENT_TYPE_HEADER = 'Content-Type';
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type RequestDefinition<T> = {
  operation: TransactionsApiOperation;
  path: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  init?: RequestInit;
  observationIdentity?: string;
  transactionExternalId?: string;
  responseTransactionExternalId?: (response: T) => string;
};

type TransactionsApiOptions = {
  apiOrigin?: string;
  fetcher?: Fetcher;
  observability?: TransactionsApiObservability;
  timeoutMs?: number;
};

export interface TransactionsApi {
  list(query: ListQuery, signal?: AbortSignal): Promise<TransactionPage>;
  get(id: string, signal?: AbortSignal): Promise<TransactionResponse>;
  create(attempt: SubmissionAttempt, signal?: AbortSignal): Promise<TransactionResponse>;
}

function readTransactionsApiOrigin(explicitOrigin?: string): string {
  const configuredOrigin = explicitOrigin ?? process.env.NEXT_PUBLIC_API_URL;
  if (!configuredOrigin) throw new Error('NEXT_PUBLIC_API_URL não configurada');
  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL deve ser uma origem HTTP(S) válida');
  }
  const hasOnlyOrigin = url.pathname === '/' && !url.search && !url.hash;
  const hasCredentials = Boolean(url.username || url.password);
  if (!HTTP_PROTOCOLS.has(url.protocol) || !hasOnlyOrigin || hasCredentials) {
    throw new Error('NEXT_PUBLIC_API_URL deve ser uma origem HTTP(S) sem credenciais');
  }
  return url.origin;
}

function buildListPath(transactionsPath: string, query: ListQuery): string {
  const search = new URLSearchParams();
  if (query.status) search.set('status', query.status);
  if (query.transferTypeId) search.set('transferTypeId', String(query.transferTypeId));
  if (query.createdAtFrom) search.set('createdAtFrom', query.createdAtFrom);
  if (query.createdAtTo) search.set('createdAtTo', query.createdAtTo);
  search.set('page', String(query.page));
  search.set('limit', String(query.limit));
  return `${transactionsPath}?${search.toString()}`;
}

export function createTransactionsApi(options: TransactionsApiOptions = {}): TransactionsApi {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const observability = options.observability ?? createTransactionsApiObservability();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const buildTransactionsPath = (suffix = '') =>
    `${readTransactionsApiOrigin(options.apiOrigin)}${TRANSACTIONS_API_PATH}${suffix}`;
  async function request<T>(definition: RequestDefinition<T>): Promise<T> {
    const controller = new AbortController();
    const startedAt = Date.now();
    let timedOut = false;
    const abortFromCaller = () => controller.abort(definition.signal?.reason);
    if (definition.signal?.aborted) abortFromCaller();
    else definition.signal?.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetcher(definition.path, {
        ...definition.init,
        cache: 'no-store',
        credentials: 'omit',
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (!response.ok) throwApiError(payload, response.status);
      const parsedResponse = parseSuccessfulResponse(payload, definition.schema, response.status);
      observability.recordRecovery({
        operation: definition.operation,
        durationMs: Date.now() - startedAt,
        status: response.status,
        requestIdentity: definition.observationIdentity,
        transactionExternalId:
          definition.responseTransactionExternalId?.(parsedResponse) ??
          definition.transactionExternalId,
      });
      return parsedResponse;
    } catch (cause) {
      const error = mapTransportError(cause, definition.signal, timedOut);
      if (error.code !== 'CANCELLED') {
        observability.recordFailure({
          operation: definition.operation,
          durationMs: Date.now() - startedAt,
          error,
          requestIdentity: definition.observationIdentity,
          transactionExternalId: definition.transactionExternalId,
        });
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      definition.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
  return {
    async list(query, signal) {
      return request({
        operation: 'list',
        path: buildListPath(buildTransactionsPath(), query),
        schema: transactionPageSchema,
        signal,
      });
    },
    async get(id, signal) {
      return request({
        operation: 'detail',
        path: buildTransactionsPath(`/${encodeURIComponent(id)}`),
        schema: transactionResponseSchema,
        signal,
        observationIdentity: id,
        transactionExternalId: id,
      });
    },
    async create(attempt, signal) {
      return request({
        operation: 'create',
        path: buildTransactionsPath(),
        schema: transactionResponseSchema,
        signal,
        observationIdentity: attempt.key,
        responseTransactionExternalId: (response) => response.transactionExternalId,
        init: {
          method: 'POST',
          headers: {
            [CONTENT_TYPE_HEADER]: 'application/json',
            [IDEMPOTENCY_KEY_HEADER]: attempt.key,
          },
          body: JSON.stringify(attempt.body),
        },
      });
    },
  };
}

export const transactionsApi = createTransactionsApi();
