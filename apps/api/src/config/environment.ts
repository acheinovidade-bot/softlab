import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().max(65535).default(3000),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    CORS_ORIGINS: z.string().min(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    SWAGGER_ENABLED: booleanString.default('true'),
    ACCESS_TOKEN_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(90).default(30),
    BARCODE_LOOKUP_PROVIDER: z.enum(['disabled', 'openfoodfacts']).default('disabled'),
    OPENFOODFACTS_USER_AGENT: z.string().min(8).optional(),
    BARCODE_LOOKUP_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(5000),
    CUSTOMER_ENRICHMENT_PROVIDER: z.enum(['disabled', 'brasilapi']).default('disabled'),
    BRASILAPI_USER_AGENT: z.string().min(8).optional(),
    BRASILAPI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(15000).default(5000),
    IMPORT_STORAGE_PATH: z.string().min(1).default('storage/imports'),
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),
    NFCE_GATEWAY_URL: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().url().optional(),
    ),
    NFCE_GATEWAY_TOKEN: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(16).optional(),
    ),
  })
  .superRefine((environment, context) => {
    if (
      environment.BARCODE_LOOKUP_PROVIDER === 'openfoodfacts' &&
      !environment.OPENFOODFACTS_USER_AGENT
    )
      context.addIssue({
        code: 'custom',
        path: ['OPENFOODFACTS_USER_AGENT'],
        message: 'User-Agent obrigatório para Open Food Facts',
      });
    if (
      environment.CUSTOMER_ENRICHMENT_PROVIDER === 'brasilapi' &&
      !environment.BRASILAPI_USER_AGENT
    )
      context.addIssue({
        code: 'custom',
        path: ['BRASILAPI_USER_AGENT'],
        message: 'User-Agent obrigatório para BrasilAPI',
      });
    if (environment.NFCE_GATEWAY_URL && !environment.NFCE_GATEWAY_TOKEN)
      context.addIssue({
        code: 'custom',
        path: ['NFCE_GATEWAY_TOKEN'],
        message: 'Token obrigatório para o gateway NFC-e',
      });
  });

export type Environment = z.infer<typeof environmentSchema>;

export function validateEnvironment(config: Record<string, unknown>): Environment {
  return environmentSchema.parse(config);
}
