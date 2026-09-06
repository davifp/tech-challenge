export const TRANSACTION_CREATED_TOPIC = 'transaction.created';
export const TRANSACTION_STATUS_UPDATED_TOPIC = 'transaction.status.updated';

export const EVENT_TOPICS = [TRANSACTION_CREATED_TOPIC, TRANSACTION_STATUS_UPDATED_TOPIC] as const;

export type EventTopic = (typeof EVENT_TOPICS)[number];
export type DeadLetterTopic = `${EventTopic}.dlq`;

export function deadLetterTopicFor(sourceTopic: EventTopic): DeadLetterTopic {
  return `${sourceTopic}.dlq`;
}
