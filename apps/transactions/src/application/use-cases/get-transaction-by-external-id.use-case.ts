import { type Transaction } from '../../domain/transaction/transaction';
import { TransactionNotFoundError } from '../errors/transaction-not-found.error';
import { type TransactionRepository } from '../ports/transaction-repository.port';

export class GetTransactionByExternalIdUseCase {
  constructor(private readonly transactionRepository: TransactionRepository) {}

  async execute(transactionExternalId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByExternalId(transactionExternalId);
    if (!transaction) throw new TransactionNotFoundError(transactionExternalId);
    return transaction;
  }
}
