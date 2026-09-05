export type CreateTransactionBody = {
  accountExternalIdDebit: string;
  accountExternalIdCredit: string;
  transferTypeId: number;
  value: number;
};

export function postTransaction(
  baseUrl: string,
  body: CreateTransactionBody,
  idempotencyKey?: string,
): Promise<Response> {
  return fetch(`${baseUrl}/transactions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

export async function transactionExternalId(response: Response): Promise<string> {
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== 'object' || !('transactionExternalId' in payload)) {
    throw new Error('Transaction response does not include transactionExternalId');
  }
  const externalId = payload.transactionExternalId;
  if (typeof externalId !== 'string') throw new Error('transactionExternalId must be a string');
  return externalId;
}
