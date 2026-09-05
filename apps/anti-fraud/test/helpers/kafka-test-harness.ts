import { Kafka, Partitioners, type Admin, type Producer, type RecordMetadata } from 'kafkajs';

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

  async publish(topic: string, key: string, value: string): Promise<RecordMetadata> {
    const [metadata] = await this.producer.send({ topic, messages: [{ key, value }] });
    if (!metadata) throw new Error('Kafka did not return test publication metadata');
    return metadata;
  }

  async committedOffset(groupId: string, topic: string, partition: number): Promise<string> {
    const offsets = await this.admin.fetchOffsets({ groupId, topics: [topic] });
    const topicOffsets = offsets.find((entry) => entry.topic === topic);
    return topicOffsets?.partitions.find((entry) => entry.partition === partition)?.offset ?? '-1';
  }

  async disconnect(): Promise<void> {
    await this.producer.disconnect();
    await this.admin.disconnect();
  }
}
