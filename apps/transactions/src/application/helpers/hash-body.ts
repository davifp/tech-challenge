import { createHash } from 'node:crypto';

import { normalizeAccountExternalId } from '../../domain/transaction/normalize-account-external-id';

const DECIMAL_SCALE = 2;
const HASH_ALGORITHM = 'sha256';
const FIELD_SEPARATOR = '|';

export type HashableBody = {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
};

export function hashBody(body: HashableBody): string {
  const canonical = [
    normalizeAccountExternalId(body.accountExternalIdDebit),
    normalizeAccountExternalId(body.accountExternalIdCredit),
    body.transferTypeId,
    body.value.toFixed(DECIMAL_SCALE),
  ].join(FIELD_SEPARATOR);
  return createHash(HASH_ALGORITHM).update(canonical).digest('hex');
}
