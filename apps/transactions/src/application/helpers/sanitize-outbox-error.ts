import { type SanitizedError } from '../ports/outbox-dispatch-logger.port';

const MAX_ERROR_MESSAGE_LENGTH = 500;
const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';
const UNKNOWN_ERROR_MESSAGE = 'Unknown publication error';
const URL_CREDENTIALS_PATTERN = /(\/\/)[^\s/@]+:[^\s/@]+@/gu;
const WHITESPACE_PATTERN = /\s+/gu;

export function sanitizeOutboxError(error: unknown): SanitizedError {
  if (!(error instanceof Error)) {
    return { code: UNKNOWN_ERROR_CODE, message: UNKNOWN_ERROR_MESSAGE };
  }
  return {
    code: error.name || UNKNOWN_ERROR_CODE,
    message: sanitizeMessage(error.message),
  };
}

export function serializeSanitizedError(error: SanitizedError): string {
  return JSON.stringify(error);
}

function sanitizeMessage(message: string): string {
  const sanitized = message
    .replace(URL_CREDENTIALS_PATTERN, '$1[redacted]@')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
  return sanitized.slice(0, MAX_ERROR_MESSAGE_LENGTH) || UNKNOWN_ERROR_MESSAGE;
}
