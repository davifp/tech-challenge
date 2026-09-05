import { type ExecutionContext, createParamDecorator } from '@nestjs/common';
import { type Request } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { z } from 'zod';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENCY_KEY_MAX_LENGTH = 64;

export const idempotencyKeySchema = z.string().min(1).max(IDEMPOTENCY_KEY_MAX_LENGTH).optional();

function extractIdempotencyKey(context: ExecutionContext): string | undefined {
  const request = context.switchToHttp().getRequest<Request>();
  const rawHeader = request.headers[IDEMPOTENCY_KEY_HEADER];
  const value = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const result = idempotencyKeySchema.safeParse(value);
  if (!result.success) throw new ZodValidationException(result.error);
  return result.data;
}

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined => extractIdempotencyKey(context),
);
