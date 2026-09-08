import type { z } from 'zod';

import {
  apiErrorEnvelopeSchema,
  transactionPageSchema,
  transactionResponseSchema,
  type ApiErrorDetail,
  type ListQuery,
  type SubmissionAttempt,
  type TransactionPage,
  type TransactionResponse,
} from '../transaction-schemas';

export const REQUEST_TIMEOUT_MS = 10_000;

const TRANSACTIONS_API_PATH = '/transactions';
const CONTENT_TYPE_HEADER = 'Content-Type';
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type TransactionsApiErrorInput = {
  code: string;
  message: string;
  status?: number;
  details?: ApiErrorDetail[];
  cause?: unknown;
};

export class TransactionsApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details: ApiErrorDetail[];

  constructor(input: TransactionsApiErrorInput) {
    super(input.message, { cause: input.cause });
    this.name = 'TransactionsApiError';
    this.code = input.code;
    this.status = input.status;
    this.details = input.details ?? [];
  }
}

type RequestDefinition<T> = {
  path: string;
  schema: z.ZodType<T>;
  signal?: AbortSignal;
  init?: RequestInit;
};

type TransactionsApiOptions = {
  apiOrigin?: string;
  fetcher?: Fetcher;
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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw new TransactionsApiError({
      code: 'INVALID_RESPONSE',
      message: 'A API retornou uma resposta que não é JSON.',
      status: response.status,
      cause,
    });
  }
}

function parseResponse<T>(payload: unknown, schema: z.ZodType<T>, status: number): T {
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  throw new TransactionsApiError({
    code: 'INVALID_RESPONSE',
    message: 'A resposta da API não corresponde ao contrato esperado.',
    status,
    cause: parsed.error,
  });
}

function throwResponseError(payload: unknown, status: number): never {
  const parsed = apiErrorEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new TransactionsApiError({
      code: 'INVALID_RESPONSE',
      message: 'A resposta de erro da API não corresponde ao contrato esperado.',
      status,
      cause: parsed.error,
    });
  }
  throw new TransactionsApiError({
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    status,
    details: parsed.data.error.details,
  });
}

function mapRequestError(
  cause: unknown,
  signal: AbortSignal | undefined,
  timedOut: boolean,
): TransactionsApiError {
  if (cause instanceof TransactionsApiError) return cause;
  if (signal?.aborted) {
    return new TransactionsApiError({
      code: 'CANCELLED',
      message: 'A requisição foi cancelada.',
      cause,
    });
  }
  if (timedOut) {
    return new TransactionsApiError({
      code: 'TIMEOUT',
      message: 'A API demorou mais que o limite configurado para responder.',
      cause,
    });
  }
  return new TransactionsApiError({
    code: 'NETWORK_ERROR',
    message: 'Não foi possível alcançar a API de transações.',
    cause,
  });
}

export function createTransactionsApi(options: TransactionsApiOptions = {}): TransactionsApi {
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const buildTransactionsPath = (suffix = '') =>
    `${readTransactionsApiOrigin(options.apiOrigin)}${TRANSACTIONS_API_PATH}${suffix}`;
  async function request<T>(definition: RequestDefinition<T>): Promise<T> {
    const controller = new AbortController();
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
      if (!response.ok) throwResponseError(payload, response.status);
      return parseResponse(payload, definition.schema, response.status);
    } catch (cause) {
      throw mapRequestError(cause, definition.signal, timedOut);
    } finally {
      clearTimeout(timeout);
      definition.signal?.removeEventListener('abort', abortFromCaller);
    }
  }
  return {
    async list(query, signal) {
      return request({
        path: buildListPath(buildTransactionsPath(), query),
        schema: transactionPageSchema,
        signal,
      });
    },
    async get(id, signal) {
      return request({
        path: buildTransactionsPath(`/${encodeURIComponent(id)}`),
        schema: transactionResponseSchema,
        signal,
      });
    },
    async create(attempt, signal) {
      return request({
        path: buildTransactionsPath(),
        schema: transactionResponseSchema,
        signal,
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
