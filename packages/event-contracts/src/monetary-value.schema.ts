import { z } from 'zod';

const DECIMAL_SCALE = 2;

function hasAtMostTwoDecimals(value: number): boolean {
  return value === Number(value.toFixed(DECIMAL_SCALE));
}

export const monetaryValueSchema = z
  .number()
  .positive()
  .refine(hasAtMostTwoDecimals, { message: 'must have up to two decimals' });
