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

const rate = z.coerce.number().min(0).max(100);
export const cardOperatorSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  taxId: z.preprocess(
    (value) =>
      value === null || value === ''
        ? null
        : typeof value === 'string'
          ? value.replace(/\D/g, '')
          : value,
    z.string().length(14).nullable(),
  ).default(null),
  debitRate: rate.default(0),
  creditRate: rate.default(0),
  installmentRate: rate.default(0),
  settlementDays: z.coerce.number().int().min(0).max(365).default(1),
  active: z.coerce.boolean().default(true),
});
export const updateCardOperatorSchema = cardOperatorSchema.partial();

export const paymentMethodSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  type: z.enum(['cash', 'pix', 'debit_card', 'credit_card', 'credit_account', 'voucher', 'other']),
  fiscalCode: z.string().trim().min(1).max(4).default('99'),
  cardOperatorId: z.string().uuid().nullable().default(null),
  maxInstallments: z.coerce.number().int().min(1).max(48).default(1),
  createsReceivable: z.coerce.boolean().default(false),
  active: z.coerce.boolean().default(true),
});
export const updatePaymentMethodSchema = paymentMethodSchema.partial();
