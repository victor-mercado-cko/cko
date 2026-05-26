import { z } from 'zod';

export const ChargeSchema = z.object({
  amount: z
    .number()
    .int('amount must be an integer (smallest currency unit)')
    .positive('amount must be positive'),
  currency: z
    .string()
    .length(3, 'currency must be a 3-letter ISO 4217 code')
    .regex(/^[A-Z]{3}$/, 'currency must be uppercase'),
  description: z.string().max(500).optional(),
  idempotency_key: z.string().max(255).optional(),
});

export type ChargeBody = z.infer<typeof ChargeSchema>;
