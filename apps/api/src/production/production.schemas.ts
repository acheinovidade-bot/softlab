import { z } from 'zod';

const quantity = z.coerce.number().positive().max(999_999_999);
const percentage = z.coerce.number().min(0).max(100);
const page = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const createBomSchema = z
  .object({
    productId: z.string().uuid(),
    yieldQuantity: quantity,
    expectedLossPercent: percentage.default(0),
    items: z
      .array(
        z.object({
          componentProductId: z.string().uuid(),
          unitId: z.string().uuid(),
          quantity,
          lossPercent: percentage.default(0),
        }),
      )
      .min(1)
      .max(100),
  })
  .superRefine((value, context) => {
    if (value.items.some(({ componentProductId }) => componentProductId === value.productId))
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'O produto acabado não pode ser seu próprio componente',
      });
    if (
      new Set(value.items.map(({ componentProductId }) => componentProductId)).size !==
      value.items.length
    )
      context.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Não repita componentes na ficha técnica',
      });
  });

export const productionListSchema = page.extend({
  status: z
    .enum(['all', 'planned', 'separation', 'processing', 'quality', 'finalized'])
    .default('all'),
});
export const createProductionOrderSchema = z.object({
  bomId: z.string().uuid(),
  plannedQuantity: quantity,
  plannedAt: z.coerce.date(),
});
export const transitionProductionSchema = z.object({
  toStatus: z.enum(['separation', 'processing', 'quality']),
  qualityNotes: z.string().trim().max(2000).optional(),
});
export const finalizeProductionSchema = z
  .object({
    locationId: z.string().uuid(),
    producedQuantity: quantity,
    lotNumber: z.string().trim().min(1).max(80),
    manufacturedAt: z.coerce.date(),
    expiresAt: z.coerce.date().nullable().default(null),
    qualityNotes: z.string().trim().max(2000).optional(),
    consumptions: z
      .array(
        z.object({
          productId: z.string().uuid(),
          lotId: z.string().uuid().nullable().default(null),
          quantity,
          lossQuantity: z.coerce.number().min(0).max(999_999_999).default(0),
        }),
      )
      .min(1)
      .max(300),
  })
  .refine(({ manufacturedAt, expiresAt }) => !expiresAt || expiresAt >= manufacturedAt, {
    path: ['expiresAt'],
    message: 'A validade não pode ser anterior à fabricação',
  });
