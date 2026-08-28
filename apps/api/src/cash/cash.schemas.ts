import { z } from 'zod';

const money = z.coerce.number().min(0).max(999_999_999);
export const createCashRegisterSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
});
export const openCashSchema = z.object({ registerId: z.string().uuid(), openingAmount: money });
export const cashMovementSchema = z.object({
  type: z.enum(['payment', 'supply', 'withdrawal']),
  amount: money.positive(),
  paymentMethodId: z.string().uuid().nullable().default(null),
  description: z.string().trim().min(3).max(240),
});
export const closeCashSchema = z.object({
  counts: z
    .array(z.object({ paymentMethodId: z.string().uuid(), countedAmount: money }))
    .min(1)
    .refine(
      (items) => new Set(items.map(({ paymentMethodId }) => paymentMethodId)).size === items.length,
      'Forma de pagamento repetida',
    ),
});
