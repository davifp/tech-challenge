export class TransactionDecisionNotAppliedError extends Error {
  constructor(readonly outcome: 'conflict' | 'not-found') {
    super(outcome);
  }
}
