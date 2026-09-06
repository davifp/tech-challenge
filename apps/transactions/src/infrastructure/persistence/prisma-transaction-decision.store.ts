import { Inject, Injectable } from '@nestjs/common';
import { TRANSACTION_STATUS_UPDATED_TOPIC } from '@tech-challenge/event-contracts';

import {
  type ApplyTransactionDecisionInput,
  type TransactionDecisionStore,
  type TransactionDecisionStoreOutcome,
} from '../../application/ports/transaction-decision-store.port';
import { decideTerminalStatusTransition } from '../../domain/transaction/terminal-status-transition.policy';
import {
  FINAL_STATUS_ID_BY_NAME,
  PENDING_STATUS_ID,
  isTransactionStatusId,
} from '../../domain/transaction/transaction-status';
import { type Prisma } from '../../generated/prisma/client';

import { resolvePrismaInboxConflict } from './prisma-inbox-duplicate';
import { PrismaService } from './prisma.service';
import { TransactionDecisionNotAppliedError } from './transaction-decision-not-applied.error';

@Injectable()
export class PrismaTransactionDecisionStore implements TransactionDecisionStore {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async apply(input: ApplyTransactionDecisionInput): Promise<TransactionDecisionStoreOutcome> {
    try {
      return await this.prisma.$transaction((database) => this.applyAtomically(database, input));
    } catch (error) {
      if (error instanceof TransactionDecisionNotAppliedError) return error.outcome;
      const findInboxEvent = (eventId: string) =>
        this.prisma.inboxEvent.findUnique({ where: { eventId } });
      const inboxOutcome = await resolvePrismaInboxConflict(findInboxEvent, input, error);
      if (inboxOutcome) return inboxOutcome;
      throw error;
    }
  }

  private async applyAtomically(
    database: Prisma.TransactionClient,
    input: ApplyTransactionDecisionInput,
  ): Promise<TransactionDecisionStoreOutcome> {
    const currentStatusId = await this.findStatus(database, input.transactionExternalId);
    if (currentStatusId === null) throw new TransactionDecisionNotAppliedError('not-found');
    const requestedStatusId = FINAL_STATUS_ID_BY_NAME[input.status];
    const transition = decideTerminalStatusTransition(currentStatusId, requestedStatusId);
    if (transition === 'conflict') throw new TransactionDecisionNotAppliedError('conflict');
    await this.recordInbox(database, input);
    if (transition === 'duplicate') return 'duplicate';
    const updated = await database.transaction.updateMany({
      where: {
        transactionExternalId: input.transactionExternalId,
        transactionStatusId: PENDING_STATUS_ID,
      },
      data: { transactionStatusId: requestedStatusId },
    });
    if (updated.count === 1) return 'applied';
    return this.resolveConcurrentTransition(database, input);
  }

  private async findStatus(database: Prisma.TransactionClient, transactionExternalId: string) {
    const transaction = await database.transaction.findUnique({
      where: { transactionExternalId },
      select: { transactionStatusId: true },
    });
    if (!transaction) return null;
    if (!isTransactionStatusId(transaction.transactionStatusId)) {
      throw new Error(`Unknown transaction status ${transaction.transactionStatusId}`);
    }
    return transaction.transactionStatusId;
  }

  private recordInbox(database: Prisma.TransactionClient, input: ApplyTransactionDecisionInput) {
    return database.inboxEvent.create({
      data: {
        eventId: input.eventId,
        eventName: TRANSACTION_STATUS_UPDATED_TOPIC,
        transactionExternalId: input.transactionExternalId,
      },
    });
  }

  private async resolveConcurrentTransition(
    database: Prisma.TransactionClient,
    input: ApplyTransactionDecisionInput,
  ): Promise<'duplicate'> {
    const currentStatusId = await this.findStatus(database, input.transactionExternalId);
    if (currentStatusId === null) throw new TransactionDecisionNotAppliedError('not-found');
    const transition = decideTerminalStatusTransition(
      currentStatusId,
      FINAL_STATUS_ID_BY_NAME[input.status],
    );
    if (transition !== 'duplicate') throw new TransactionDecisionNotAppliedError('conflict');
    return 'duplicate';
  }
}
