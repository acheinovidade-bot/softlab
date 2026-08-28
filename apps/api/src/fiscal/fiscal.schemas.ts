import { z } from 'zod';

export const fiscalSettingSchema = z.object({
  taxRegime: z.enum(['simples_nacional', 'simples_excesso', 'normal']),
  environment: z.enum(['homologation', 'production']),
  certificateSecretReference: z.string().trim().min(3).max(500),
  settings: z.record(z.unknown()).default({}),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().nullable().default(null),
});

export const nfceGatewayResponseSchema = z.object({
  status: z.literal('authorized'),
  accessKey: z.string().regex(/^\d{44}$/),
  protocol: z.string().min(1).max(60),
  series: z.coerce.string().min(1).max(10),
  number: z.coerce.number().int().positive(),
  issuedAt: z.coerce.date(),
  qrCodeUrl: z.string().url(),
  xmlStorageKey: z.string().min(1).nullable().optional(),
});

export const nfeGatewayResponseSchema = nfceGatewayResponseSchema.extend({
  qrCodeUrl: z.string().url().nullable().optional(),
});
