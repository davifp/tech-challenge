import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';

const MESSAGE_TIMEOUT_MS = 10000;

export type ProbedKafkaMessage = {
  topic: string;
  key: string | null;
  value: string;
  partition: number;
  offset: string;
};
type MessageWaiter = {
  resolve: (message: ProbedKafkaMessage) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class KafkaEventProbe {
  private readonly consumer: Consumer;
  private readonly messages = new Map<string, ProbedKafkaMessage>();
  private readonly waiters = new Map<string, MessageWaiter>();

  constructor(input: { brokers: string[]; clientId: string; groupId: string }) {
    const kafka = new Kafka({ brokers: input.brokers, clientId: input.clientId });
    this.consumer = kafka.consumer({ groupId: input.groupId });
  }

  async start(topics: string[]): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topics, fromBeginning: false });
    const groupJoined = this.waitForGroupJoin();
    await this.consumer.run({ eachMessage: (payload) => this.capture(payload) });
    await groupJoined;
  }

  waitFor(topic: string, key: string): Promise<ProbedKafkaMessage> {
    const messageId = this.messageId(topic, key);
    const existing = this.messages.get(messageId);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(messageId);
        reject(new Error(`Kafka message not received from ${topic} with key ${key}`));
      }, MESSAGE_TIMEOUT_MS);
      this.waiters.set(messageId, { resolve, timer });
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
  }

  private waitForGroupJoin(): Promise<void> {
    return new Promise((resolve) => {
      const removeListener = this.consumer.on(this.consumer.events.GROUP_JOIN, () => {
        removeListener();
        resolve();
      });
    });
  }

  private capture(payload: EachMessagePayload): Promise<void> {
    if (!payload.message.value) return Promise.resolve();
    const message: ProbedKafkaMessage = {
      topic: payload.topic,
      key: payload.message.key?.toString('utf8') ?? null,
      value: payload.message.value.toString('utf8'),
      partition: payload.partition,
      offset: payload.message.offset,
    };
    const messageId = this.messageId(message.topic, message.key);
    this.messages.set(messageId, message);
    const waiter = this.waiters.get(messageId);
    if (!waiter) return Promise.resolve();
    clearTimeout(waiter.timer);
    this.waiters.delete(messageId);
    waiter.resolve(message);
    return Promise.resolve();
  }

  private messageId(topic: string, key: string | null): string {
    return `${topic}:${key ?? ''}`;
  }
}
