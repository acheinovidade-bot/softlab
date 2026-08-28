import { z } from 'zod';

const envReference = z.string().regex(/^WHATSAPP_[A-Z0-9_]+$/, 'Use uma variável WHATSAPP_*');

export const whatsappConfigSchema = z.object({
  status: z.enum(['active', 'inactive']).default('inactive'),
  provider: z.literal('evolution').default('evolution'),
  baseUrl: z
    .string()
    .url()
    .transform((value) => value.replace(/\/$/, '')),
  instanceName: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[A-Za-z0-9._-]+$/),
  sendTextPath: z
    .string()
    .min(1)
    .max(240)
    .refine(
      (value) => value.startsWith('/') && value.includes('{instance}'),
      'O caminho deve começar com / e conter {instance}',
    )
    .default('/message/sendText/{instance}'),
  apiKeyEnvKey: envReference,
  webhookSecretEnvKey: envReference,
});

export type WhatsappPublicConfig = z.infer<typeof whatsappConfigSchema>;
