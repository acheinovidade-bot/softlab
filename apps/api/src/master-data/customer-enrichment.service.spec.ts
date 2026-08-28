import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.types';
import { CustomerEnrichmentService } from './customer-enrichment.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['sales'] };
function config(provider = 'brasilapi') { return { get: jest.fn((key: string) => key === 'CUSTOMER_ENRICHMENT_PROVIDER' ? provider : 5000), getOrThrow: jest.fn().mockReturnValue('ERP-Hibrido/0.1 (test@example.com)') }; }
function redis(allowed = true) { return { consumeRateLimit: jest.fn().mockResolvedValue(allowed) }; }

describe('CustomerEnrichmentService', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; jest.clearAllMocks(); });

  it('maps a CNPJ result without persisting it', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ razao_social: 'Empresa Exemplo Ltda', nome_fantasia: 'Exemplo', ddd_telefone_1: '8533334444', email: 'CONTATO@EXEMPLO.COM', cep: '60123-000', logradouro: 'Rua Central', numero: '10', bairro: 'Centro', municipio: 'Fortaleza', uf: 'CE', descricao_situacao_cadastral: 'ATIVA' }) }) as typeof fetch;
    await expect(new CustomerEnrichmentService(config() as never, redis() as never).lookupCnpj(auth, '11222333000181')).resolves.toMatchObject({ found: true, fields: { legalName: 'Empresa Exemplo Ltda', email: 'contato@exemplo.com', address: { postalCode: '60123000', city: 'Fortaleza', state: 'CE' } } });
  });

  it('maps a CEP suggestion', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ cep: '60123000', state: 'CE', city: 'Fortaleza', neighborhood: 'Centro', street: 'Rua Central' }) }) as typeof fetch;
    await expect(new CustomerEnrichmentService(config() as never, redis() as never).lookupCep(auth, '60123000')).resolves.toMatchObject({ found: true, fields: { street: 'Rua Central', district: 'Centro' } });
  });

  it('returns a controlled result when a record is not found', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
    await expect(new CustomerEnrichmentService(config() as never, redis() as never).lookupCep(auth, '60123000')).resolves.toMatchObject({ found: false, fields: null });
  });

  it('fails closed when rate limiting is unavailable or exceeded', async () => {
    await expect(new CustomerEnrichmentService(config() as never, redis(false) as never).lookupCep(auth, '60123000')).rejects.toBeInstanceOf(HttpException);
    await expect(new CustomerEnrichmentService(config('disabled') as never, redis() as never).lookupCep(auth, '60123000')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
