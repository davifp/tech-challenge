import { type TransactionStatusName } from '../../domain/transaction/transaction-status';
import { TransferTypeNotFoundError } from '../errors/transfer-type-not-found.error';
import { type TransactionCatalogRepository } from '../ports/transaction-catalog-repository.port';
import {
  type ListTransactionsFilters,
  type TransactionRepository,
} from '../ports/transaction-repository.port';

const DEFAULT_PAGE = 1;
const MIN_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

export type ListTransactionsQuery = {
  status?: TransactionStatusName;
  transferTypeId?: number;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  page?: number;
  limit?: number;
};

export type ListTransactionsResult = {
  items: Awaited<ReturnType<TransactionRepository['list']>>['items'];
  page: number;
  limit: number;
  total: number;
};

export class ListTransactionsUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly catalogRepository: TransactionCatalogRepository,
  ) {}

  async execute(query: ListTransactionsQuery = {}): Promise<ListTransactionsResult> {
    const filters = normalizeFilters(query);
    await this.assertTransferTypeExists(filters.transferTypeId);
    const { items, total } = await this.transactionRepository.list(filters);
    return { items, page: filters.page, limit: filters.limit, total };
  }

  private async assertTransferTypeExists(transferTypeId: number | undefined): Promise<void> {
    if (!transferTypeId) return;
    const transferType = await this.catalogRepository.findTransferTypeById(transferTypeId);
    if (!transferType) throw new TransferTypeNotFoundError(transferTypeId);
  }
}

function normalizeFilters(query: ListTransactionsQuery): ListTransactionsFilters {
  return {
    status: query.status,
    transferTypeId: query.transferTypeId,
    createdAtFrom: query.createdAtFrom,
    createdAtTo: query.createdAtTo,
    page: Math.max(MIN_PAGE, query.page ?? DEFAULT_PAGE),
    limit: Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, query.limit ?? DEFAULT_LIMIT)),
  };
}
