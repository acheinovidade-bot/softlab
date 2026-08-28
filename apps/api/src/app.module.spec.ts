import { Test } from '@nestjs/testing';

describe('AppModule', () => {
  it('resolves the complete dependency graph', async () => {
    process.env.DATABASE_URL = 'postgresql://erp:test@localhost:5432/erp';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.ACCESS_TOKEN_SECRET = 'test-secret-with-more-than-32-characters';
    const { AppModule } = await import('./app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(module).toBeDefined();
    await module.close();
  });
});
