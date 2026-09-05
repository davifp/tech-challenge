import {
  Injectable,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';

import type { DispatchOutboxEventsUseCase } from '../../application/use-cases/dispatch-outbox-events.use-case';

export type OutboxDispatcher = Pick<DispatchOutboxEventsUseCase, 'execute'>;

export interface PublisherLifecycle {
  disconnect(): Promise<void>;
}

export type OutboxRunnerConfig = {
  enabled: boolean;
  pollIntervalMs: number;
  batchSize: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
};

@Injectable()
export class OutboxDispatcherRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private stopped = true;
  private timer?: ReturnType<typeof setTimeout>;
  private running?: Promise<void>;

  constructor(
    private readonly dispatch: OutboxDispatcher,
    private readonly publisher: PublisherLifecycle,
    private readonly config: OutboxRunnerConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.enabled) return;
    this.stopped = false;
    this.schedule(0);
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
    await this.publisher.disconnect();
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => this.run(), delayMs);
  }

  private run(): void {
    this.running = this.executeCycle();
    void this.running.finally(() => {
      this.running = undefined;
      this.schedule(this.config.pollIntervalMs);
    });
  }

  private async executeCycle(): Promise<void> {
    await this.dispatch.execute({
      now: new Date(),
      batchSize: this.config.batchSize,
      retryBaseDelayMs: this.config.retryBaseDelayMs,
      retryMaxDelayMs: this.config.retryMaxDelayMs,
    });
  }
}
