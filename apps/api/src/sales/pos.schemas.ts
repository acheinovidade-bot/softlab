import { z } from 'zod';

const money = z.coerce.number().min(0).max(999_999_999);
export const posCheckoutSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    customerId: z.string().uuid().nullable().default(null),
    sellerId: z.string().uuid(),
    locationId: z.string().uuid(),
    notes: z.string().trim().max(2000).nullable().default(null),
    creditDueDate: z.string().date().nullable().default(null),
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.coerce.number().positive().max(999_999),
          unitPrice: money.nullable().default(null),
          discount: money.default(0),
        }),
      )
      .min(1)
      .max(200),
    payments: z
      .array(
        z.object({
          paymentMethodId: z.string().uuid(),
          amount: z.coerce.number().positive().max(999_999_999),
          installments: z.coerce.number().int().min(1).max(48).default(1),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((value, context) => {
    if (new Set(value.items.map(({ productId }) => productId)).size !== value.items.length)
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Não repita produtos; ajuste a quantidade',
      });
    if (
      new Set(value.payments.map(({ paymentMethodId }) => paymentMethodId)).size !==
      value.payments.length
    )
      context.addIssue({
        code: 'custom',
        path: ['payments'],
        message: 'Não repita a forma de pagamento',
      });
  });

export const customerStatementQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const receiveCreditSchema = z.object({
  amount: money.positive(),
  paymentMethodId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const posSettingsSchema = z.object({
  defaultCustomerId: z.string().uuid().nullable().default(null),
  defaultSellerId: z.string().uuid(),
  defaultLocationId: z.string().uuid(),
});
