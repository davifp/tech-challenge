import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { type Response } from 'express';

import { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import { GetTransactionByExternalIdUseCase } from '../../application/use-cases/get-transaction-by-external-id.use-case';
import { ListTransactionsUseCase } from '../../application/use-cases/list-transactions.use-case';

import { IdempotencyKey } from './decorators/idempotency-key.decorator';
import { CreateTransactionDto } from './dtos/create-transaction.dto';
import { ListTransactionsDto } from './dtos/list-transactions.dto';
import { TransactionPathDto } from './dtos/transaction-path.dto';
import {
  toTransactionResponse,
  type TransactionResponse,
} from './mappers/transaction-response.mapper';

const TRANSACTIONS_PATH = '/transactions';

type ListTransactionsResponse = {
  items: TransactionResponse[];
  page: number;
  limit: number;
  total: number;
};

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly createTransaction: CreateTransactionUseCase,
    private readonly getTransactionByExternalId: GetTransactionByExternalIdUseCase,
    private readonly listTransactions: ListTransactionsUseCase,
  ) {}

  @Post()
  async create(
    @Body() body: CreateTransactionDto,
    @IdempotencyKey() idempotencyKey: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TransactionResponse> {
    const { transaction, wasReplayed } = await this.createTransaction.execute({
      accountExternalIdDebit: body.accountExternalIdDebit,
      accountExternalIdCredit: body.accountExternalIdCredit,
      transferTypeId: body.transferTypeId,
      value: body.value,
      idempotencyKey,
    });
    if (wasReplayed) {
      response.status(HttpStatus.OK);
    } else {
      response.status(HttpStatus.CREATED);
      response.setHeader('Location', `${TRANSACTIONS_PATH}/${transaction.transactionExternalId}`);
    }
    return toTransactionResponse(transaction);
  }

  @Get(':transactionExternalId')
  @HttpCode(HttpStatus.OK)
  async findById(@Param() params: TransactionPathDto): Promise<TransactionResponse> {
    const transaction = await this.getTransactionByExternalId.execute(params.transactionExternalId);
    return toTransactionResponse(transaction);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@Query() query: ListTransactionsDto): Promise<ListTransactionsResponse> {
    const { items, page, limit, total } = await this.listTransactions.execute({
      status: query.status,
      transferTypeId: query.transferTypeId,
      createdAtFrom: query.createdAtFrom ? new Date(query.createdAtFrom) : undefined,
      createdAtTo: query.createdAtTo ? new Date(query.createdAtTo) : undefined,
      page: query.page,
      limit: query.limit,
    });
    return { items: items.map(toTransactionResponse), page, limit, total };
  }
}
