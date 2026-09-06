import { TRANSACTION_STATUS_UPDATED_TOPIC } from '@tech-challenge/event-contracts';

import { type ApplyTransactionDecisionInput } from '../../application/ports/transaction-decision-store.port';

import { isPrismaUniqueConflictOn } from './prisma-unique-conflict';

const INBOX_EVENT_ID_FIELD = 'eventId';
const INBOX_PRIMARY_KEY = 'InboxEvent_pkey';

type InboxIdentity = { eventName: string; transactionExternalId: string };
type FindInboxEvent = (eventId: string) => Promise<InboxIdentity | null>;

function isInboxUniqueConflict(error: unknown): boolean {
  return (
    isPrismaUniqueConflictOn(error, INBOX_EVENT_ID_FIELD) ||
    isPrismaUniqueConflictOn(error, INBOX_PRIMARY_KEY)
  );
}

export async function resolvePrismaInboxConflict(
  findInboxEvent: FindInboxEvent,
  input: ApplyTransactionDecisionInput,
  error: unknown,
): Promise<'duplicate' | 'conflict' | null> {
  if (!isInboxUniqueConflict(error)) return null;
  const persisted = await findInboxEvent(input.eventId);
  if (!persisted) throw error;
  const isSameEvent =
    persisted.eventName === TRANSACTION_STATUS_UPDATED_TOPIC &&
    persisted.transactionExternalId === input.transactionExternalId;
  return isSameEvent ? 'duplicate' : 'conflict';
}
