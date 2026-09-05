export const ANTI_FRAUD_APPROVAL_LIMIT = 1000;

export type AntiFraudDecision = 'approved' | 'rejected';

export class AntiFraudPolicy {
  decide(value: number): AntiFraudDecision {
    return value <= ANTI_FRAUD_APPROVAL_LIMIT ? 'approved' : 'rejected';
  }
}
