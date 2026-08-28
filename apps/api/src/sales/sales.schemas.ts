import { z } from 'zod';

const money = z.coerce.number().min(0).max(999_999_999);
const item = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive().max(999_999_999),
  unitPrice: money.nullable().default(null),
  discount: money.default(0),
});
export const createSalesQuoteSchema = z
  .object({
    customerId: z.string().uuid().nullable().default(null),
    sellerId: z.string().uuid(),
    paymentMethodId: z.string().uuid(),
    validUntil: z.coerce.date().nullable().default(null),
    discount: money.default(0),
    surcharge: money.default(0),
    freight: money.default(0),
    notes: z.string().trim().max(3000).nullable().default(null),
    items: z.array(item).min(1).max(200),
  })
  .superRefine((value, context) => {
    if (new Set(value.items.map(({ productId }) => productId)).size !== value.items.length)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Não repita produtos no orçamento',
      });
  });
export const quoteTransitionSchema = z.object({
  toStatus: z.enum(['sent', 'approved', 'canceled']),
});
export const orderTransitionSchema = z.object({
  toStatus: z.enum(['separation', 'invoicing', 'delivery', 'completed', 'canceled']),
});
export const allocateOrderSchema = z
  .object({
    items: z
      .array(
        z.object({
          orderItemId: z.string().uuid(),
          locationId: z.string().uuid(),
          lotId: z.string().uuid().nullable().default(null),
        }),
      )
      .min(1)
      .max(200),
  })
  .superRefine((value, context) => {
    if (new Set(value.items.map(({ orderItemId }) => orderItemId)).size !== value.items.length)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Não repita itens na separação',
      });
  });
export const salesListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().trim().max(30).default('all'),
});
