export class TransferTypeNotFoundError extends Error {
  readonly code = 'TRANSFER_TYPE_NOT_FOUND';
  readonly transferTypeId: number;

  constructor(transferTypeId: number) {
    super(`Transfer type ${transferTypeId} not found`);
    this.name = 'TransferTypeNotFoundError';
    this.transferTypeId = transferTypeId;
  }
}
