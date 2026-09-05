export type KafkaRecord = {
  topic: string;
  partition: number;
  offset: string;
  key: string | null;
  value: string | null;
};
