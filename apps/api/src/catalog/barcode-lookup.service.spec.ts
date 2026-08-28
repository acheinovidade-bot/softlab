import { ServiceUnavailableException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.types';
import { BarcodeLookupService } from './barcode-lookup.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['catalog'] };
function config(provider = 'openfoodfacts') { return { get: jest.fn((key: string) => key === 'BARCODE_LOOKUP_PROVIDER' ? provider : 5000), getOrThrow: jest.fn().mockReturnValue('ERP-Hibrido/0.1 (test@example.com)') }; }
const redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) };

describe('BarcodeLookupService', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; jest.clearAllMocks(); });
  it('maps provider data into an explicit suggestion', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ status: 'success', product: { product_name: 'Creme de avelã', abbreviated_product_name: 'Creme', brands: 'Marca Exemplo', image_front_url: 'https://images.openfoodfacts.org/product.jpg', quantity: '350 g' } }) }) as jest.MockedFunction<typeof fetch>; globalThis.fetch = fetchMock;
    const result = await new BarcodeLookupService(config() as never, redis as never).lookup(auth, '3017624010701');
    expect(result).toMatchObject({ found: true, fields: { description: 'Creme de avelã', brandName: 'Marca Exemplo', ncm: null } });
    const call = fetchMock.mock.calls[0]; const url = call?.[0]; expect(typeof url === 'string' ? url : '').toContain('/api/v3/product/3017624010701.json'); expect(call?.[1]?.headers).toEqual({ 'user-agent': 'ERP-Hibrido/0.1 (test@example.com)', accept: 'application/json' });
  });
  it('returns a non-error suggestion when the product is unknown', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;
    await expect(new BarcodeLookupService(config() as never, redis as never).lookup(auth, '3017624010701')).resolves.toMatchObject({ found: false, fields: null });
  });
  it('fails closed when no provider is configured', async () => {
    await expect(new BarcodeLookupService(config('disabled') as never, redis as never).lookup(auth, '3017624010701')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
