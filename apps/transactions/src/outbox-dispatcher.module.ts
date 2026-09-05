import { Module } from '@nestjs/common';

import { EVENT_PUBLISHER } from './application/ports/event-publisher.port';
import { OUTBOX_DISPATCH_LOGGER } from './application/ports/outbox-dispatch-logger.port';
import { OUTBOX_EVENT_REPOSITORY } from './application/ports/outbox-event.repository.port';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { outboxDispatcherProviders } from './outbox-dispatcher.providers';

@Module({
  providers: outboxDispatcherProviders,
  exports: [PrismaService, OUTBOX_EVENT_REPOSITORY, EVENT_PUBLISHER, OUTBOX_DISPATCH_LOGGER],
})
export class OutboxDispatcherModule {}
