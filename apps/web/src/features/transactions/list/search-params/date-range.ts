import { TZDate } from '@date-fns/tz';

import { BUSINESS_TIME_ZONE } from '../../transaction-formatters';

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MILLISECOND = 1;

export type CivilDateRange = {
  from?: string;
  to?: string;
};

export type CivilDateRangeError = 'invalid-from' | 'invalid-to' | 'inverted-range';

export type CivilDateRangeValidation = { ok: true } | { ok: false; reason: CivilDateRangeError };

type CivilDateParts = { year: number; month: number; day: number };

function toCivilDateParts(candidate: string): CivilDateParts {
  const [year, month, day] = candidate.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

export function isCivilDate(candidate: string): boolean {
  if (!CIVIL_DATE_PATTERN.test(candidate)) return false;
  const { year, month, day } = toCivilDateParts(candidate);
  const reference = new Date(Date.UTC(year, month - 1, day));
  return (
    reference.getUTCFullYear() === year &&
    reference.getUTCMonth() === month - 1 &&
    reference.getUTCDate() === day
  );
}

export function validateCivilDateRange(range: CivilDateRange): CivilDateRangeValidation {
  if (range.from !== undefined && !isCivilDate(range.from)) {
    return { ok: false, reason: 'invalid-from' };
  }
  if (range.to !== undefined && !isCivilDate(range.to)) {
    return { ok: false, reason: 'invalid-to' };
  }
  if (range.from && range.to && range.from > range.to) {
    return { ok: false, reason: 'inverted-range' };
  }
  return { ok: true };
}

export function startOfBrasiliaCivilDayIso(civilDate: string): string {
  const { year, month, day } = toCivilDateParts(civilDate);
  const start = new TZDate(year, month - 1, day, 0, 0, 0, 0, BUSINESS_TIME_ZONE);
  return new Date(start.getTime()).toISOString();
}

export function endOfBrasiliaCivilDayIso(civilDate: string): string {
  const { year, month, day } = toCivilDateParts(civilDate);
  const startOfNextDay = new TZDate(year, month - 1, day + 1, 0, 0, 0, 0, BUSINESS_TIME_ZONE);
  return new Date(startOfNextDay.getTime() - MILLISECOND).toISOString();
}
