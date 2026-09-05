import { randomUUID } from 'node:crypto';

import { Kafka, type Consumer, type KafkaMessage } from 'kafkajs';

const MESSAGE_TIMEOUT_MS = 10000;

export type ProbedKafkaMessage = { key: string; value: string };
type MessageWaiter = {
  resolve: (message: ProbedKafkaMessage) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class KafkaEventProbe {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly messages = new Map<string, ProbedKafkaMessage>();
  private readonly waiters = new Map<string, MessageWaiter>();

  constructor(input: { brokers: string[]; clientId: string }) {
    this.kafka = new Kafka({ brokers: input.brokers, clientId: input.clientId });
    this.consumer = this.kafka.consumer({ groupId: `${input.clientId}-${randomUUID()}` });
  }

  async start(topic: string): Promise<void> {
    await this.ensureTopic(topic);
    await this.consumer.connect();
    await this.consumer.subscribe({ topic, fromBeginning: true });
    await this.consumer.run({
      eachMessage: ({ message }) => {
        this.capture(message);
        return Promise.resolve();
      },
    });
  }

  waitForKey(key: string): Promise<ProbedKafkaMessage> {
    const existing = this.messages.get(key);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(key);
        reject(new Error(`Kafka message not received for key ${key}`));
      }, MESSAGE_TIMEOUT_MS);
      this.waiters.set(key, { resolve, timer });
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  private async ensureTopic(topic: string): Promise<void> {
    const admin = this.kafka.admin();
    await admin.connect();
    try {
      const topics = await admin.listTopics();
      if (!topics.includes(topic)) {
        await admin.createTopics({ waitForLeaders: true, topics: [{ topic }] });
      }
    } finally {
      await admin.disconnect();
    }
  }

  private capture(message: KafkaMessage): void {
    if (!message.key || !message.value) return;
    const received = { key: message.key.toString(), value: message.value.toString() };
    this.messages.set(received.key, received);
    const waiter = this.waiters.get(received.key);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.waiters.delete(received.key);
    waiter.resolve(received);
  }
}
