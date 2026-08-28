import { z } from 'zod';

const uuid = z.string().uuid();
export const stockListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().trim().max(120).default('') });
export const movementListSchema = stockListSchema.extend({ productId: uuid.optional(), movementType: z.enum(['entry', 'exit', 'adjustment_in', 'adjustment_out', 'loss', 'return_in']).optional() });
export const adjustmentSchema = z.object({
  productId: uuid, locationId: uuid, lotId: uuid.nullable().default(null),
  movementType: z.enum(['entry', 'exit', 'adjustment_in', 'adjustment_out', 'loss', 'return_in']),
  quantity: z.coerce.number().positive().max(999_999_999_999), unitCost: z.coerce.number().min(0).max(999_999_999_999).nullable().default(null),
  reason: z.string().trim().min(5).max(500),
});
export const createLotSchema = z.object({
  productId: uuid, lotNumber: z.string().trim().min(1).max(80),
  manufacturedAt: z.coerce.date().nullable().default(null), expiresAt: z.coerce.date().nullable().default(null),
}).superRefine(({ manufacturedAt, expiresAt }, context) => { if (manufacturedAt && expiresAt && expiresAt < manufacturedAt) context.addIssue({ code: 'custom', path: ['expiresAt'], message: 'Validade deve ser posterior à fabricação' }); });
export const lotListSchema = stockListSchema.extend({ status: z.enum(['all', 'expired', '15', '30', '60', '90']).default('all') });
export const fefoSchema = z.object({ quantity: z.coerce.number().positive().max(999_999_999_999), locationId: uuid.optional() });
