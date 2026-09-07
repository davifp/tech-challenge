import { type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EVENT_PUBLISHER, type EventPublisher } from './application/ports/event-publisher.port';
import {
  OUTBOX_DISPATCH_LOGGER,
  type OutboxDispatchLogger,
} from './application/ports/outbox-dispatch-logger.port';
import {
  OUTBOX_EVENT_REPOSITORY,
  type OutboxEventRepository,
} from './application/ports/outbox-event.repository.port';
import { DispatchOutboxEventsUseCase } from './application/use-cases/dispatch-outbox-events.use-case';
import { type Env } from './infrastructure/config/env.schema';
import { KafkaJsEventPublisher } from './infrastructure/kafka/transaction-created/kafkajs-event.publisher';
import { NestOutboxDispatchLogger } from './infrastructure/logging/nest-outbox-dispatch.logger';
import { OutboxDispatcherRunner } from './infrastructure/outbox/outbox-dispatcher.runner';
import { PrismaOutboxEventRepository } from './infrastructure/persistence/prisma-outbox-event.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { kafkaPublisherConfig, outboxRunnerConfig } from './outbox-dispatcher.config';

const adapterProviders: Provider[] = [
  PrismaService,
  PrismaOutboxEventRepository,
  NestOutboxDispatchLogger,
  {
    provide: KafkaJsEventPublisher,
    useFactory: (config: ConfigService<Env, true>) =>
      new KafkaJsEventPublisher(kafkaPublisherConfig(config)),
    inject: [ConfigService],
  },
  { provide: OUTBOX_EVENT_REPOSITORY, useExisting: PrismaOutboxEventRepository },
  { provide: EVENT_PUBLISHER, useExisting: KafkaJsEventPublisher },
  { provide: OUTBOX_DISPATCH_LOGGER, useExisting: NestOutboxDispatchLogger },
];

const useCaseProvider: Provider = {
  provide: DispatchOutboxEventsUseCase,
  useFactory: (
    outbox: OutboxEventRepository,
    publisher: EventPublisher,
    logger: OutboxDispatchLogger,
  ) => new DispatchOutboxEventsUseCase(outbox, publisher, logger),
  inject: [OUTBOX_EVENT_REPOSITORY, EVENT_PUBLISHER, OUTBOX_DISPATCH_LOGGER],
};

const runnerProvider: Provider = {
  provide: OutboxDispatcherRunner,
  useFactory: (
    dispatch: DispatchOutboxEventsUseCase,
    publisher: KafkaJsEventPublisher,
    config: ConfigService<Env, true>,
  ) => new OutboxDispatcherRunner(dispatch, publisher, outboxRunnerConfig(config)),
  inject: [DispatchOutboxEventsUseCase, KafkaJsEventPublisher, ConfigService],
};

export const outboxDispatcherProviders: Provider[] = [
  ...adapterProviders,
  useCaseProvider,
  runnerProvider,
];
