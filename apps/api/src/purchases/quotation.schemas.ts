import { z } from 'zod';

export const createQuotationSchema = z.object({
  suggestionId: z.string().uuid(),
  responseDeadline: z.coerce.date(),
});

export const quotationListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const quotationResponseSchema = z.object({
  items: z
    .array(
      z.object({
        quotationItemId: z.string().uuid(),
        brand: z.string().trim().max(120).nullable().default(null),
        offeredQuantity: z.coerce.number().min(0).max(999_999_999),
        unitPrice: z.coerce.number().min(0).max(999_999_999),
        leadDays: z.coerce.number().int().min(0).max(3650).nullable().default(null),
        paymentTerms: z.string().trim().max(500).nullable().default(null),
        paymentTermDays: z.coerce.number().int().min(0).max(3650).nullable().default(null),
        notes: z.string().trim().max(2000).nullable().default(null),
      }),
    )
    .min(1)
    .max(500)
    .superRefine((items, context) => {
      const ids = items.map(({ quotationItemId }) => quotationItemId);
      if (new Set(ids).size !== ids.length)
        context.addIssue({ code: 'custom', message: 'Item repetido na resposta' });
    }),
});
