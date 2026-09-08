import { randomUUID } from 'node:crypto';

import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';

import { KafkaProbeBuffer, type ProbedKafkaMessage } from './kafka-probe-buffer';

export { type ProbedKafkaMessage } from './kafka-probe-buffer';

export class KafkaEventProbe {
  private readonly kafka: Kafka;
  private readonly consumer: Consumer;
  private readonly buffer = new KafkaProbeBuffer();

  constructor(input: { brokers: string[]; clientId: string; groupId?: string }) {
    this.kafka = new Kafka({ brokers: input.brokers, clientId: input.clientId });
    this.consumer = this.kafka.consumer({
      groupId: input.groupId ?? `${input.clientId}-${randomUUID()}`,
    });
  }

  async start(topics: string | string[]): Promise<void> {
    const subscribedTopics = Array.isArray(topics) ? topics : [topics];
    await Promise.all(subscribedTopics.map((topic) => this.ensureTopic(topic)));
    await this.consumer.connect();
    await this.consumer.subscribe({ topics: subscribedTopics, fromBeginning: false });
    const groupJoined = this.waitForGroupJoin();
    await this.consumer.run({ eachMessage: (payload) => this.capture(payload) });
    await groupJoined;
  }

  waitForKey(key: string): Promise<ProbedKafkaMessage> {
    return this.waitFor('', key, 1);
  }

  waitFor(topic: string, key: string, occurrence = 1): Promise<ProbedKafkaMessage> {
    return this.buffer.waitFor(topic, key, occurrence);
  }

  async disconnect(): Promise<void> {
    this.buffer.rejectWaiters();
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

  private capture(payload: EachMessagePayload): Promise<void> {
    const { message } = payload;
    if (!message.key || !message.value) return Promise.resolve();
    const received = {
      topic: payload.topic,
      key: message.key.toString(),
      value: message.value.toString(),
      partition: payload.partition,
      offset: message.offset,
    };
    this.buffer.capture(payload.topic, received);
    return Promise.resolve();
  }
}
