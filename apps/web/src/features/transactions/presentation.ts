import type { ApiErrorDetail, TransactionStatus, TransactionType } from './contracts';

export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';
export const BUSINESS_TIME_ZONE_LABEL = 'Horário de Brasília';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: BUSINESS_TIME_ZONE,
});

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
};

const TYPE_LABELS: Record<TransactionType, string> = {
  pix: 'Pix',
  ted: 'TED',
  book_transfer: 'Book Transfer',
};

const ERROR_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Revise os campos informados e tente novamente.',
  TRANSFER_TYPE_NOT_FOUND: 'Selecione um tipo de transferência disponível.',
  INVALID_TRANSACTION: 'Revise os dados da transação e tente novamente.',
  TRANSACTION_NOT_FOUND: 'A transação informada não foi encontrada.',
  IDEMPOTENCY_KEY_CONFLICT:
    'Esta tentativa já foi usada com outros dados. Inicie uma nova tentativa.',
  INTERNAL_ERROR: 'A API encontrou uma falha. Tente novamente em alguns instantes.',
  NETWORK_ERROR: 'Não foi possível conectar à API. Verifique a conexão e tente novamente.',
  TIMEOUT: 'A API demorou para responder. Tente novamente.',
  INVALID_RESPONSE: 'A API retornou dados inesperados. Tente novamente mais tarde.',
  CANCELLED: 'A consulta foi interrompida.',
};

const FIELD_ERROR_MESSAGES: Record<string, string> = {
  accountExternalIdDebit: 'Informe uma conta de débito válida.',
  accountExternalIdCredit: 'Informe uma conta de crédito válida e diferente da conta de débito.',
  transferTypeId: 'Selecione um tipo de transferência disponível.',
  value: 'Informe um valor positivo com até duas casas decimais.',
  createdAtFrom: 'Informe uma data inicial válida.',
  createdAtTo: 'Informe uma data final válida e posterior à data inicial.',
};

export function formatCurrency(value: number): string {
  return CURRENCY_FORMATTER.format(value);
}

export function formatDateTime(isoDate: string): string {
  return DATE_TIME_FORMATTER.format(new Date(isoDate));
}

export function transactionStatusLabel(status: string): string {
  return STATUS_LABELS[status as TransactionStatus] ?? 'Status desconhecido';
}

export function transactionTypeLabel(type: string): string {
  return TYPE_LABELS[type as TransactionType] ?? 'Tipo desconhecido';
}

export function apiErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Não foi possível concluir a operação. Tente novamente.';
}

export function apiFieldErrorMessage(detail: ApiErrorDetail): string {
  return (
    FIELD_ERROR_MESSAGES[detail.path] ??
    'Um campo informado não é válido. Revise o formulário e tente novamente.'
  );
}
