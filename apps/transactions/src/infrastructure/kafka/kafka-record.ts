import { type EachMessagePayload } from 'kafkajs';

export type KafkaRecord = {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
};

export function toKafkaRecord(payload: EachMessagePayload): KafkaRecord {
  return {
    topic: payload.topic,
    partition: payload.partition,
    offset: payload.message.offset,
    key: payload.message.key?.toString('utf8') ?? null,
    value: payload.message.value?.toString('utf8') ?? null,
  };
}

export function nextOffset(offset: string): string {
  return (BigInt(offset) + 1n).toString();
}
