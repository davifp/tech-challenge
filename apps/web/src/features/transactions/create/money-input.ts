import type { KeyboardEvent } from 'react';

const VALUE_FORMATTER = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const NON_MONEY_CHARACTER_PATTERN = /[^\d,]/g;
const MONEY_DECIMAL_PLACES = 2;
const MONEY_CONTROL_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'Backspace',
  'Delete',
  'End',
  'Enter',
  'Escape',
  'Home',
  'Tab',
]);

export function formatValueForInput(value: number): string {
  return normalizeMoneyInput(VALUE_FORMATTER.format(value));
}

export function normalizeMoneyInput(value: string): string {
  const sanitized = value.replace(NON_MONEY_CHARACTER_PATTERN, '');
  const [integerPart = '', ...fractionParts] = sanitized.split(',');
  if (fractionParts.length === 0) return integerPart;
  const fractionPart = fractionParts.join('').slice(0, MONEY_DECIMAL_PLACES);
  return `${integerPart},${fractionPart}`;
}

export function isAllowedMoneyKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  if (event.ctrlKey || event.metaKey || MONEY_CONTROL_KEYS.has(event.key)) return true;
  const input = event.currentTarget;
  const selectionStart = input.selectionStart ?? input.value.length;
  const selectionEnd = input.selectionEnd ?? input.value.length;
  const nextValue = `${input.value.slice(0, selectionStart)}${event.key}${input.value.slice(selectionEnd)}`;
  return normalizeMoneyInput(nextValue) === nextValue;
}
