import { Kafka, Partitioners, type Admin, type Producer, type RecordMetadata } from 'kafkajs';

type PublishedRecordMetadata = RecordMetadata & { baseOffset: string };
const POLL_INTERVAL_MS = 50;
const POLL_TIMEOUT_MS = 10000;

export class KafkaTestHarness {
  private readonly admin: Admin;
  private readonly producer: Producer;

  constructor(input: { brokers: string[]; clientId: string }) {
    const kafka = new Kafka(input);
    this.admin = kafka.admin();
    this.producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });
  }

  async connect(): Promise<void> {
    await this.admin.connect();
    await this.producer.connect();
  }

  async ensureTopics(topics: string[]): Promise<void> {
    const existingTopics = await this.admin.listTopics();
    const missingTopics = topics.filter((topic) => !existingTopics.includes(topic));
    if (missingTopics.length === 0) return;
    await this.admin.createTopics({
      waitForLeaders: true,
      topics: missingTopics.map((topic) => ({ topic })),
    });
  }

  async publish(topic: string, key: string, value: string): Promise<PublishedRecordMetadata> {
    const [metadata] = await this.producer.send({ topic, messages: [{ key, value }] });
    if (!metadata?.baseOffset) throw new Error('Kafka did not return test publication metadata');
    return { ...metadata, baseOffset: metadata.baseOffset };
  }

  async committedOffset(groupId: string, topic: string, partition: number): Promise<string> {
    const offsets = await this.admin.fetchOffsets({ groupId, topics: [topic] });
    const topicOffsets = offsets.find((entry) => entry.topic === topic);
    return topicOffsets?.partitions.find((entry) => entry.partition === partition)?.offset ?? '-1';
  }

  async waitForActiveGroups(groupIds: string[]): Promise<void> {
    await this.pollUntil(
      async () => {
        const { groups } = await this.admin.describeGroups(groupIds);
        return groupIds.every((groupId) => {
          const group = groups.find((entry) => entry.groupId === groupId);
          return group?.state === 'Stable' && group.members.length > 0;
        });
      },
      `Kafka consumer groups ${groupIds.join(', ')} did not become active`,
    );
  }

  async waitForCommittedOffset(input: {
    groupId: string;
    topic: string;
    partition: number;
    offset: string;
  }): Promise<void> {
    await this.pollUntil(async () => {
      const committed = await this.committedOffset(input.groupId, input.topic, input.partition);
      return BigInt(committed) >= BigInt(input.offset);
    }, `Kafka consumer group ${input.groupId} did not commit offset ${input.offset}`);
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.admin.disconnect();
  }

  private async pollUntil(check: () => Promise<boolean>, timeoutMessage: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    throw new Error(timeoutMessage);
  }
}
