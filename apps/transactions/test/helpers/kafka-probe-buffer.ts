const MESSAGE_TIMEOUT_MS = 10000;

export type ProbedKafkaMessage = {
  topic: string;
  key: string;
  value: string;
  partition: number;
  offset: string;
};

type MessageWaiter = {
  resolve: (message: ProbedKafkaMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class KafkaProbeBuffer {
  private readonly messages = new Map<string, ProbedKafkaMessage[]>();
  private readonly waiters = new Map<string, MessageWaiter>();

  waitFor(topic: string, key: string, occurrence: number): Promise<ProbedKafkaMessage> {
    const messageId = this.messageId(topic, key);
    const existing = this.messages.get(messageId)?.[occurrence - 1];
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const waiterId = this.waiterId(messageId, occurrence);
      const timer = setTimeout(() => {
        this.waiters.delete(waiterId);
        reject(
          new Error(`Kafka message ${occurrence} not received from ${topic || '*'} for ${key}`),
        );
      }, MESSAGE_TIMEOUT_MS);
      this.waiters.set(waiterId, { resolve, reject, timer });
    });
  }

  capture(topic: string, message: ProbedKafkaMessage): void {
    this.captureForId(this.messageId(topic, message.key), message);
    this.captureForId(this.messageId('', message.key), message);
  }

  rejectWaiters(): void {
    for (const waiter of this.waiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Kafka probe disconnected before receiving the expected message'));
    }
    this.waiters.clear();
  }

  private captureForId(messageId: string, message: ProbedKafkaMessage): void {
    const messages = [...(this.messages.get(messageId) ?? []), message];
    this.messages.set(messageId, messages);
    const waiterId = this.waiterId(messageId, messages.length);
    const waiter = this.waiters.get(waiterId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.waiters.delete(waiterId);
    waiter.resolve(message);
  }

  private messageId(topic: string, key: string): string {
    return `${topic}:${key}`;
  }

  private waiterId(messageId: string, occurrence: number): string {
    return `${messageId}:${occurrence}`;
  }
}
