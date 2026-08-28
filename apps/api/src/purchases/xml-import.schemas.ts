import { z } from 'zod';

export const xmlPreviewSchema = z.object({ xml: z.string().min(50).max(2_000_000) });
export const xmlMappingSchema = z.object({ productId: z.string().uuid() });
export const importListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
