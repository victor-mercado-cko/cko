import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const StoreCardSchema = z.object({
  pan: z
    .string()
    .min(13)
    .max(19)
    .regex(/^\d+$/, 'PAN must contain only digits'),
  expiry_month: z
    .string()
    .regex(/^(0[1-9]|1[0-2])$/, 'expiry_month must be MM (01–12)'),
  expiry_year: z
    .string()
    .regex(/^\d{4}$/, 'expiry_year must be YYYY')
    .refine((y) => parseInt(y, 10) >= currentYear, 'expiry_year is in the past'),
  cardholder_name: z.string().min(1).max(255).optional(),
});

export type StoreCardBody = z.infer<typeof StoreCardSchema>;
