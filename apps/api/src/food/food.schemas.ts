import { z } from 'zod';
export const createTableSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(30)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2).max(80),
  capacity: z.coerce.number().int().positive().max(100),
});
export const openTabSchema = z
  .object({
    tableId: z.string().uuid().nullable().default(null),
    customerId: z.string().uuid().nullable().default(null),
    waiterId: z.string().uuid().nullable().default(null),
    channel: z.enum(['table', 'delivery', 'counter', 'pickup', 'kiosk', 'digital_menu']),
    guests: z.coerce.number().int().positive().max(100).default(1),
    notes: z.string().trim().max(1000).nullable().default(null),
  })
  .superRefine((value, context) => {
    if (value.channel === 'table' && !value.tableId)
      context.addIssue({ code: 'custom', path: ['tableId'], message: 'Informe a mesa' });
  });
export const addTabItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999),
  notes: z.string().trim().max(500).nullable().default(null),
});
export const checkoutFoodSchema = z.object({
  idempotencyKey: z.string().uuid(),
  sellerId: z.string().uuid(),
  locationId: z.string().uuid(),
  payments: z
    .array(z.object({ paymentMethodId: z.string().uuid(), amount: z.coerce.number().positive() }))
    .min(1),
});
