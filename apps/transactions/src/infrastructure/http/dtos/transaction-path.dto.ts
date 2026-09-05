import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const transactionPathSchema = z.strictObject({
  transactionExternalId: z.uuid(),
});

export class TransactionPathDto extends createZodDto(transactionPathSchema) {}
