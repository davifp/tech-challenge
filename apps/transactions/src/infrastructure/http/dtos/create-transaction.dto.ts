import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const DECIMAL_SCALE = 2;

function hasAtMostTwoDecimals(value: number): boolean {
  return Number.isFinite(value) && value === Number(value.toFixed(DECIMAL_SCALE));
}

export const createTransactionSchema = z
  .strictObject({
    accountExternalIdDebit: z.uuid().describe('Debit account UUID'),
    accountExternalIdCredit: z.uuid().describe('Credit account UUID'),
    transferTypeId: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .describe('Transfer type. 1=pix, 2=ted, 3=book_transfer.'),
    value: z
      .number()
      .positive()
      .refine(hasAtMostTwoDecimals, { message: 'must have up to two decimals' }),
  })
  .refine(
    (data) =>
      data.accountExternalIdDebit.toLowerCase() !== data.accountExternalIdCredit.toLowerCase(),
    {
      message: 'accountExternalIdDebit must be different from accountExternalIdCredit',
      path: ['accountExternalIdCredit'],
    },
  );

export class CreateTransactionDto extends createZodDto(createTransactionSchema) {}
