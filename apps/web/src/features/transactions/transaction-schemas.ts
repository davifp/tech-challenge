import { z } from 'zod';

const MONEY_DECIMAL_SCALE = 2;
const MINIMUM_PAGE = 1;
const MINIMUM_PAGE_SIZE = 1;
const MAXIMUM_PAGE_SIZE = 100;

function hasAtMostTwoDecimals(value: number): boolean {
  return value === Number(value.toFixed(MONEY_DECIMAL_SCALE));
}

export const transactionStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export const transactionTypeSchema = z.enum(['pix', 'ted', 'book_transfer']);
export const transactionTypeIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const createTransactionInputSchema = z
  .strictObject({
    accountExternalIdDebit: z.uuid().transform((value) => value.toLowerCase()),
    accountExternalIdCredit: z.uuid().transform((value) => value.toLowerCase()),
    transferTypeId: transactionTypeIdSchema,
    value: z.number().finite().positive().refine(hasAtMostTwoDecimals),
  })
  .refine((input) => input.accountExternalIdDebit !== input.accountExternalIdCredit, {
    path: ['accountExternalIdCredit'],
    message: 'As contas de débito e crédito devem ser diferentes.',
  });

export const transactionResponseSchema = z.strictObject({
  transactionExternalId: z.uuid(),
  transactionType: z.strictObject({ name: transactionTypeSchema }),
  transactionStatus: z.strictObject({ name: transactionStatusSchema }),
  value: z.number().finite().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  accountExternalIdDebit: z.uuid(),
  accountExternalIdCredit: z.uuid(),
});

export const transactionPageSchema = z.strictObject({
  items: z.array(transactionResponseSchema),
  page: z.number().int().min(MINIMUM_PAGE),
  limit: z.number().int().min(MINIMUM_PAGE_SIZE).max(MAXIMUM_PAGE_SIZE),
  total: z.number().int().nonnegative(),
});

export const listQuerySchema = z.strictObject({
  status: transactionStatusSchema.optional(),
  transferTypeId: transactionTypeIdSchema.optional(),
  createdAtFrom: z.iso.datetime({ offset: true }).optional(),
  createdAtTo: z.iso.datetime({ offset: true }).optional(),
  page: z.number().int().min(MINIMUM_PAGE),
  limit: z.number().int().min(MINIMUM_PAGE_SIZE).max(MAXIMUM_PAGE_SIZE),
});

export const submissionAttemptSchema = z.strictObject({
  key: z.uuid(),
  body: createTransactionInputSchema,
  state: z.enum(['sending', 'uncertain']),
});

export const apiErrorDetailSchema = z.strictObject({
  path: z.string(),
  message: z.string(),
});

export const apiErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    details: z.array(apiErrorDetailSchema).optional(),
  }),
});

export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionTypeId = z.infer<typeof transactionTypeIdSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionPage = z.infer<typeof transactionPageSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type SubmissionAttempt = z.infer<typeof submissionAttemptSchema>;
export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;
