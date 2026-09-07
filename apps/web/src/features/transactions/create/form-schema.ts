import { z } from 'zod';

const MONEY_DECIMAL_SCALE = 2;

function hasAtMostTwoDecimals(value: number): boolean {
  return value === Number(value.toFixed(MONEY_DECIMAL_SCALE));
}

function parseBrazilianDecimal(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

export const createTransactionFormSchema = z
  .object({
    accountExternalIdDebit: z
      .uuid('Informe o identificador UUID da conta de débito.')
      .transform((v) => v.toLowerCase()),
    accountExternalIdCredit: z
      .uuid('Informe o identificador UUID da conta de crédito.')
      .transform((v) => v.toLowerCase()),
    value: z
      .string()
      .min(1, 'Informe o valor da transferência.')
      .transform((raw, ctx) => {
        const num = parseBrazilianDecimal(raw);
        if (!isFinite(num) || num <= 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Informe um valor positivo com até duas casas decimais.',
          });
          return z.NEVER;
        }
        if (!hasAtMostTwoDecimals(num)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Informe até duas casas decimais, sem arredondamento.',
          });
          return z.NEVER;
        }
        return num;
      }),
  })
  .refine((data) => data.accountExternalIdDebit !== data.accountExternalIdCredit, {
    path: ['accountExternalIdCredit'],
    message: 'As contas de débito e crédito devem ser diferentes.',
  });

export type CreateTransactionFormInput = z.input<typeof createTransactionFormSchema>;
export type CreateTransactionFormOutput = z.output<typeof createTransactionFormSchema>;
