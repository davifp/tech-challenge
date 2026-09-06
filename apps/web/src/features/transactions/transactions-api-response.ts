import type { z } from 'zod';

import { apiErrorEnvelopeSchema, type ApiErrorDetail } from './contracts';

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

export async function readJson(response: Response): Promise<unknown> {
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

export function parseSuccessfulResponse<T>(
  payload: unknown,
  schema: z.ZodType<T>,
  status: number,
): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new TransactionsApiError({
      code: 'INVALID_RESPONSE',
      message: 'A resposta da API não corresponde ao contrato esperado.',
      status,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

export function throwApiError(payload: unknown, status: number): never {
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

export function mapTransportError(
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
