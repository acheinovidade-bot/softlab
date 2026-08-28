import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('rejects missing service URLs', () => {
    expect(() => validateEnvironment({ CORS_ORIGINS: 'http://localhost:5173' })).toThrow();
  });

  it('parses a valid configuration', () => {
    const env = validateEnvironment({
      DATABASE_URL: 'postgresql://erp:password@localhost:5432/erp',
      REDIS_URL: 'redis://localhost:6379',
      CORS_ORIGINS: 'http://localhost:5173',
      ACCESS_TOKEN_SECRET: 'a-secure-test-secret-with-32-characters',
    });
    expect(env.API_PORT).toBe(3000);
  });

  it('requires an identifiable user agent when barcode lookup is enabled', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://erp:password@localhost:5432/erp', REDIS_URL: 'redis://localhost:6379', CORS_ORIGINS: 'http://localhost:5173', ACCESS_TOKEN_SECRET: 'a-secure-test-secret-with-32-characters', BARCODE_LOOKUP_PROVIDER: 'openfoodfacts' })).toThrow();
  });

  it('requires an identifiable user agent when customer enrichment is enabled', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://erp:password@localhost:5432/erp', REDIS_URL: 'redis://localhost:6379', CORS_ORIGINS: 'http://localhost:5173', ACCESS_TOKEN_SECRET: 'a-secure-test-secret-with-32-characters', CUSTOMER_ENRICHMENT_PROVIDER: 'brasilapi' })).toThrow();
  });
});
