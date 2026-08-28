import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { SalesService } from './sales.service';

const auth: AccessTokenPayload = {
  sub: '018f4f12-2222-7222-8222-000000000001',
  companyId: '018f4f12-2222-7222-8222-000000000002',
  branchId: '018f4f12-2222-7222-8222-000000000003',
  sessionId: 'session',
  permissions: [],
  modules: ['sales'],
};
const quoteId = '018f4f12-2222-7222-8222-000000000004';

describe('SalesService', () => {
  it('converts an approved quote without recalculating or retyping its items', async () => {
    let copiedQuantity = '';
    let paymentAmount = '';
    const quote = {
      id: quoteId,
      companyId: auth.companyId,
      branchId: auth.branchId,
      customerId: null,
      sellerId: 'seller',
      paymentMethodId: 'method',
      number: 'ORC-1',
      status: 'approved',
      validUntil: new Date('2099-09-30'),
      subtotal: new Prisma.Decimal(50),
      discount: new Prisma.Decimal(5),
      surcharge: new Prisma.Decimal(0),
      freight: new Prisma.Decimal(5),
      total: new Prisma.Decimal(50),
      notes: null,
    };
    const tx = {
      salesQuote: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: { create: jest.fn().mockResolvedValue({}) },
      orderItem: {
        createMany: jest.fn((input: { data: Array<{ quantity: Prisma.Decimal }> }) => {
          copiedQuantity = input.data[0]?.quantity.toString() ?? '';
          return Promise.resolve({ count: 1 });
        }),
      },
      payment: {
        create: jest.fn((input: { data: { amount: Prisma.Decimal } }) => {
          paymentAmount = input.data.amount.toString();
          return Promise.resolve({});
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      salesQuote: { findFirst: jest.fn().mockResolvedValue(quote) },
      salesQuoteItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'item',
            companyId: auth.companyId,
            salesQuoteId: quoteId,
            productId: 'product',
            description: 'Produto',
            quantity: new Prisma.Decimal(2),
            unitPrice: new Prisma.Decimal(25),
            discount: new Prisma.Decimal(0),
            total: new Prisma.Decimal(50),
          },
        ]),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new SalesService(prisma as never);
    jest.spyOn(service, 'getOrder').mockResolvedValue({ id: 'order' } as never);
    await service.convertQuote(auth, quoteId);
    expect(copiedQuantity).toBe('2');
    expect(paymentAmount).toBe('50');
    expect(tx.salesQuote.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });

  it('consumes the reservation and records lot trace when invoicing', async () => {
    let movementQuantity = '';
    const separated = {
      id: 'order',
      companyId: auth.companyId,
      branchId: auth.branchId,
      status: 'separation',
      total: new Prisma.Decimal(30),
    };
    const item = {
      id: 'order-item',
      productId: 'product',
      locationId: 'location',
      lotId: 'lot',
      quantity: new Prisma.Decimal(3),
      unitPrice: new Prisma.Decimal(10),
      total: new Prisma.Decimal(30),
    };
    const tx = {
      order: {
        findFirst: jest.fn().mockResolvedValue(separated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderItem: { findMany: jest.fn().mockResolvedValue([item]) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product',
            description: 'Produto',
            allowsNegativeStock: false,
            taxProfile: { ncm: '1234' },
          },
        ]),
      },
      sale: { create: jest.fn().mockResolvedValue({}) },
      stockBalance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'balance',
          quantity: new Prisma.Decimal(10),
          reservedQuantity: new Prisma.Decimal(3),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      stockMovement: {
        create: jest.fn((input: { data: { quantity: Prisma.Decimal } }) => {
          movementQuantity = input.data.quantity.toString();
          return Promise.resolve({ id: 'movement' });
        }),
      },
      saleItem: { create: jest.fn().mockResolvedValue({ id: 'sale-item' }) },
      saleItemTrace: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(separated) },
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new SalesService(prisma as never);
    jest
      .spyOn(service, 'getOrder')
      .mockResolvedValue({ id: 'order', status: 'invoicing' } as never);
    await service.transitionOrder(auth, 'order', { toStatus: 'invoicing' });
    expect(movementQuantity).toBe('-3');
    expect(tx.sale.create).toHaveBeenCalledTimes(1);
    expect(tx.saleItemTrace.create).toHaveBeenCalledTimes(1);
    expect(tx.stockBalance.update).toHaveBeenCalledTimes(1);
  });
});
