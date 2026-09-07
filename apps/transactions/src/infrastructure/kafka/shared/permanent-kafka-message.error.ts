export class PermanentKafkaMessageError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = PermanentKafkaMessageError.name;
  }
}
