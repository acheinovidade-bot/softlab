import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { MasterDataService } from './master-data.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['purchases'] };

describe('supplier catalog tenant isolation', () => {
  it('compares only links and suppliers from the token company', async () => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: 'product', code: 'P1', description: 'Produto' }) }, supplierProduct: { findMany: jest.fn().mockResolvedValue([{ supplierId: 'supplier', supplierCode: 'X1', supplierDescription: null, lastPrice: new Prisma.Decimal(12) }]) }, supplier: { findMany: jest.fn().mockResolvedValue([{ id: 'supplier', legalName: 'Fornecedor', tradeName: null, averageLeadDays: 5, active: true }]) } };
    const result = await new MasterDataService(prisma as never).compareSupplierPrices(auth, '018f4f12-2222-7222-8222-999999999999');
    expect(prisma.supplierProduct.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, productId: '018f4f12-2222-7222-8222-999999999999' } });
    expect(prisma.supplier.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, deletedAt: null, id: { in: ['supplier'] } }, select: { id: true, legalName: true, tradeName: true, averageLeadDays: true, active: true } });
    expect(result.bestRecordedPrice?.toString()).toBe('12');
  });

  it('rejects product links that do not belong to the company', async () => {
    const prisma = { supplier: { findFirst: jest.fn().mockResolvedValue({ id: 'supplier' }) }, product: { findMany: jest.fn().mockResolvedValue([]) } };
    await expect(new MasterDataService(prisma as never).replaceSupplierProducts(auth, '018f4f12-2222-7222-8222-555555555555', { products: [{ productId: '018f4f12-2222-7222-8222-999999999999' }] })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.product.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, deletedAt: null, id: { in: ['018f4f12-2222-7222-8222-999999999999'] } }, select: { id: true } });
  });
});
