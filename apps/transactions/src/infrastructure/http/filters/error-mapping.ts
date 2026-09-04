import { HttpException, type Type } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { IdempotencyKeyConflictError } from '../../../application/errors/idempotency-key-conflict.error';
import { TransactionNotFoundError } from '../../../application/errors/transaction-not-found.error';
import { TransferTypeNotFoundError } from '../../../application/errors/transfer-type-not-found.error';
import { InvalidTransactionError } from '../../../domain/errors/invalid-transaction.error';

export const HTTP_BAD_REQUEST = 400;
export const HTTP_NOT_FOUND = 404;
export const HTTP_UNPROCESSABLE_ENTITY = 422;
export const HTTP_INTERNAL_ERROR = 500;

export type ErrorDetail = { path: string; message: string };

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
};

export type ErrorMapping = { status: number; envelope: ErrorEnvelope };

type CodedError = Error & { readonly code: string };

const STATUS_BY_ERROR: ReadonlyArray<[Type<CodedError>, number]> = [
  [InvalidTransactionError, HTTP_BAD_REQUEST],
  [TransferTypeNotFoundError, HTTP_BAD_REQUEST],
  [TransactionNotFoundError, HTTP_NOT_FOUND],
  [IdempotencyKeyConflictError, HTTP_UNPROCESSABLE_ENTITY],
];

const CODE_BY_HTTP_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

function envelope(code: string, message: string, details?: ErrorDetail[]): ErrorEnvelope {
  return { error: { code, message, ...(details ? { details } : {}) } };
}

function mapZodIssues(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
}

function mapZodValidation(exception: ZodValidationException): ErrorMapping {
  const zodError = exception.getZodError();
  const details = zodError instanceof ZodError ? mapZodIssues(zodError) : undefined;
  return {
    status: HTTP_BAD_REQUEST,
    envelope: envelope('VALIDATION_ERROR', 'Invalid request payload', details),
  };
}

function mapCodedError(exception: unknown): ErrorMapping | null {
  for (const [ErrorClass, status] of STATUS_BY_ERROR) {
    if (exception instanceof ErrorClass) {
      return { status, envelope: envelope(exception.code, exception.message) };
    }
  }
  return null;
}

function mapHttpException(exception: HttpException): ErrorMapping {
  const status = exception.getStatus();
  const code = CODE_BY_HTTP_STATUS[status] ?? 'HTTP_ERROR';
  return { status, envelope: envelope(code, exception.message) };
}

export function mapException(exception: unknown): ErrorMapping {
  if (exception instanceof ZodValidationException) return mapZodValidation(exception);
  const coded = mapCodedError(exception);
  if (coded) return coded;
  if (exception instanceof HttpException) return mapHttpException(exception);
  return {
    status: HTTP_INTERNAL_ERROR,
    envelope: envelope('INTERNAL_ERROR', 'Internal server error'),
  };
}
