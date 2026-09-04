import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DECIMAL_SCALE = 2;

function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && value === Number(value.toFixed(DECIMAL_SCALE));
}

export const createTransactionSchema = z
  .strictObject({
    accountExternalIdDebit: z.uuid(),
    accountExternalIdCredit: z.uuid(),
    transferTypeId: z.int().min(1),
    value: z
      .number()
      .positive()
      .refine(hasAtMostTwoDecimals, { message: 'must have up to two decimals' }),
  })
  .refine((data) => data.accountExternalIdDebit !== data.accountExternalIdCredit, {
    message: 'accountExternalIdDebit must be different from accountExternalIdCredit',
    path: ['accountExternalIdCredit'],
  });

export class CreateTransactionDto extends createZodDto(createTransactionSchema) {}
