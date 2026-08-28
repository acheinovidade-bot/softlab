import type { AccessTokenPayload } from '../auth/auth.types';
import { CatalogService } from './catalog.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: ['catalog.products.read'], modules: ['catalog'] };
function database() { return { product: { findMany: jest.fn(), count: jest.fn() }, productPrice: { findMany: jest.fn() } }; }
describe('CatalogService', () => {
  it('scopes listings to the tenant and hides cost without permission', async () => { const prisma = database(); prisma.product.findMany.mockResolvedValue([{ id: 'product', companyId: auth.companyId, code: 'P1', description: 'Produto' }]); prisma.product.count.mockResolvedValue(1); prisma.productPrice.findMany.mockResolvedValue([{ id: 'price', productId: 'product', cost: '10.0000', salePrice: '20.0000' }]); const result = await new CatalogService(prisma as never).list(auth, { search: 'Produto' }); expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, deletedAt: null, active: true, OR: [{ code: { contains: 'Produto', mode: 'insensitive' } }, { description: { contains: 'Produto', mode: 'insensitive' } }, { barcode: { contains: 'Produto' } }, { reference: { contains: 'Produto', mode: 'insensitive' } }] }, orderBy: { description: 'asc' }, skip: 0, take: 20 }); expect(result.items[0]?.price).not.toHaveProperty('cost'); });
});
