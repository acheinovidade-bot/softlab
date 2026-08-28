import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { StockService } from './stock.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['stock'] };
const productId = '018f4f12-2222-7222-8222-999999999999'; const locationId = '018f4f12-2222-7222-8222-888888888888';

describe('StockService', () => {
  it('scopes overview balances and settings to the current branch', async () => {
    const prisma = { product: { findMany: jest.fn().mockResolvedValue([{ id: productId, code: 'P1', description: 'Produto', controlsLot: false, controlsExpiry: false }]), count: jest.fn().mockResolvedValue(1) }, stockBalance: { findMany: jest.fn().mockResolvedValue([{ productId, quantity: new Prisma.Decimal(5), reservedQuantity: new Prisma.Decimal(1) }]) }, productBranchSetting: { findMany: jest.fn().mockResolvedValue([{ productId, minimumStock: new Prisma.Decimal(2) }]) } };
    const result = await new StockService(prisma as never).overview(auth, {});
    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, branchId: auth.branchId, productId: { in: [productId] } } }); expect(result.items[0]).toMatchObject({ status: 'ok' }); expect(result.items[0]?.availableQuantity.toString()).toBe('4');
  });

  it('prevents an outbound adjustment from making available stock negative', async () => {
    const tx = { stockBalance: { findFirst: jest.fn().mockResolvedValue({ id: 'balance', quantity: new Prisma.Decimal(1), reservedQuantity: new Prisma.Decimal(0) }), update: jest.fn(), create: jest.fn() }, stockMovement: { create: jest.fn() }, auditLog: { create: jest.fn() } };
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: productId, controlsLot: false, allowsNegativeStock: false }) }, stockLocation: { findFirst: jest.fn().mockResolvedValue({ id: locationId, warehouseId: 'warehouse' }) }, warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse' }) }, $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)) };
    await expect(new StockService(prisma as never).adjust(auth, { productId, locationId, movementType: 'exit', quantity: 2, reason: 'Saída de conferência' })).rejects.toBeInstanceOf(ConflictException); expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a location outside the current branch', async () => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: productId, controlsLot: false, allowsNegativeStock: false }) }, stockLocation: { findFirst: jest.fn().mockResolvedValue({ id: locationId, warehouseId: 'warehouse' }) }, warehouse: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new StockService(prisma as never).adjust(auth, { productId, locationId, movementType: 'entry', quantity: 1, reason: 'Entrada de conferência' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('suggests FEFO allocations without writing stock', async () => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: productId, code: 'P1', description: 'Produto', controlsLot: true }) }, stockBalance: { findMany: jest.fn().mockResolvedValue([{ lotId: 'lot-later', quantity: new Prisma.Decimal(8), reservedQuantity: new Prisma.Decimal(0) }, { lotId: 'lot-first', quantity: new Prisma.Decimal(4), reservedQuantity: new Prisma.Decimal(1) }]) }, stockLot: { findMany: jest.fn().mockResolvedValue([{ id: 'lot-later', lotNumber: 'L2', expiresAt: new Date('2099-02-01') }, { id: 'lot-first', lotNumber: 'L1', expiresAt: new Date('2099-01-01') }]) } };
    const result = await new StockService(prisma as never).fefo(auth, productId, { quantity: 5 });
    expect(result.allocations.map(({ lotNumber, quantity }) => [lotNumber, quantity.toString()])).toEqual([['L1', '3'], ['L2', '2']]); expect(result.fulfilled).toBe(true); expect(prisma.stockBalance.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, branchId: auth.branchId, productId, lotId: { not: null } } });
  });

  it('requires expiry when the product controls validity', async () => {
    const prisma = { product: { findFirst: jest.fn().mockResolvedValue({ id: productId, controlsLot: true, controlsExpiry: true }) } };
    await expect(new StockService(prisma as never).createLot(auth, { productId, lotNumber: 'L1' })).rejects.toBeInstanceOf(ConflictException);
  });
});
