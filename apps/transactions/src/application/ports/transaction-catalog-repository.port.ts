import {
  type TransactionTypeId,
  type TransactionTypeName,
} from '../../domain/transaction/transaction-type';

export const TRANSACTION_CATALOG_REPOSITORY = Symbol('TransactionCatalogRepository');

export type TransferTypeCatalogEntry = {
  id: TransactionTypeId;
  name: TransactionTypeName;
};

export interface TransactionCatalogRepository {
  findTransferTypeById(id: number): Promise<TransferTypeCatalogEntry | null>;
}
