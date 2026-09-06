import { Injectable } from '@nestjs/common';
import { transactionCreatedV1Schema } from '@tech-challenge/event-contracts';

import {
  type FindDueOutboxEventsInput,
  type OutboxEventRepository,
  type PendingOutboxEvent,
  type ScheduleOutboxRetryInput,
} from '../../application/ports/outbox-event.repository.port';

import { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOutboxEventRepository implements OutboxEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDue(input: FindDueOutboxEventsInput): Promise<PendingOutboxEvent[]> {
    const records = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null, nextAttemptAt: { lte: input.dueAt } },
      orderBy: [{ nextAttemptAt: 'asc' }, { eventId: 'asc' }],
      take: input.limit,
      select: { payload: true, attemptCount: true },
    });
    return records.map((record) => ({
      event: transactionCreatedV1Schema.parse(record.payload),
      attemptCount: record.attemptCount,
    }));
  }

  async markPublished(eventId: string, publishedAt: Date): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { eventId, publishedAt: null },
      data: { publishedAt, lastError: null },
    });
  }

  async scheduleRetry(input: ScheduleOutboxRetryInput): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { eventId: input.eventId, publishedAt: null },
      data: {
        attemptCount: { increment: 1 },
        nextAttemptAt: input.nextAttemptAt,
        lastError: input.lastError,
      },
    });
  }
}
