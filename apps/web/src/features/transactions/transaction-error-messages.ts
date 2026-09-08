import type { ApiErrorDetail } from './transaction-schemas';

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

export function apiErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? 'Não foi possível concluir a operação. Tente novamente.';
}

export function apiFieldErrorMessage(detail: ApiErrorDetail): string {
  return (
    FIELD_ERROR_MESSAGES[detail.path] ??
    'Um campo informado não é válido. Revise o formulário e tente novamente.'
  );
}
