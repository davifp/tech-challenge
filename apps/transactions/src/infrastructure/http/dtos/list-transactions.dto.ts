import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

const statusSchema = z.enum(['pending', 'approved', 'rejected']);

export const listTransactionsSchema = z
  .object({
    status: statusSchema.optional(),
    transferTypeId: z.coerce
      .number()
      .pipe(z.union([z.literal(1), z.literal(2), z.literal(3)]))
      .optional(),
    createdAtFrom: z.iso.datetime({ offset: true }).optional(),
    createdAtTo: z.iso.datetime({ offset: true }).optional(),
    page: z.coerce.number().int().min(DEFAULT_PAGE).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(MIN_LIMIT).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  })
  .superRefine((data, ctx) => {
    if (!data.createdAtFrom || !data.createdAtTo) return;
    if (new Date(data.createdAtTo) < new Date(data.createdAtFrom)) {
      ctx.addIssue({
        code: 'custom',
        message: 'createdAtTo must be greater than or equal to createdAtFrom',
        path: ['createdAtTo'],
      });
    }
  });

export class ListTransactionsDto extends createZodDto(listTransactionsSchema) {}
