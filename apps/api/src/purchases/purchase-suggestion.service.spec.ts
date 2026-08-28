import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { PurchaseSuggestionService } from './purchase-suggestion.service';

const auth: AccessTokenPayload = {
  sub: '018f4f12-2222-7222-8222-333333333333',
  companyId: '018f4f12-2222-7222-8222-111111111111',
  branchId: '018f4f12-2222-7222-8222-222222222222',
  sessionId: '018f4f12-2222-7222-8222-444444444444',
  permissions: [],
  modules: ['purchases'],
};
const productId = '018f4f12-2222-7222-8222-999999999999';

describe('PurchaseSuggestionService', () => {
  it('calculates demand, trend, coverage, open purchases and supplier lead time', async () => {
    let suggestion: Record<string, unknown> | null = null;
    let items: Array<Record<string, unknown>> = [];
    const tx = {
      purchaseSuggestion: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          suggestion = data;
          return data;
        }),
      },
      purchaseSuggestionItem: {
        createMany: jest.fn(({ data }: { data: Array<Record<string, unknown>> }) => {
          items = data;
          return { count: data.length };
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $queryRaw: jest.fn((query: Prisma.Sql) => {
        expect(query.values).toEqual(expect.arrayContaining([auth.companyId, auth.branchId]));
        return Promise.resolve([
          {
            productId,
            code: 'P1',
            description: 'Produto inteligente',
            minimumStock: new Prisma.Decimal(10),
            maximumStock: new Prisma.Decimal(60),
            availableStock: new Prisma.Decimal(20),
            historySales: new Prisma.Decimal(90),
            recentSales: new Prisma.Decimal(60),
            previousSales: new Prisma.Decimal(30),
            seasonalSales: new Prisma.Decimal(30),
            pendingPurchase: new Prisma.Decimal(5),
            inTransitPurchase: new Prisma.Decimal(3),
            leadDays: 10,
          },
        ]);
      }),
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
      purchaseSuggestion: {
        findFirst: jest.fn(() => Promise.resolve(suggestion)),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      purchaseSuggestionItem: {
        findMany: jest.fn(() => Promise.resolve(items)),
      },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: productId, code: 'P1', description: 'Produto inteligente' }]),
      },
    };
    const result = await new PurchaseSuggestionService(prisma as never).calculate(auth, {
      forecastDays: 30,
      historyDays: 90,
    });
    const calculated = result.items[0]!;
    expect(calculated.averageDailySales.toString()).toBe('1');
    expect(calculated.pendingPurchase.toString()).toBe('8');
    expect(calculated.suggestedQuantity.toString()).toBe('32');
    expect(calculated.explanation).toMatchObject({
      forecastDemand: '45',
      leadTimeDemand: '15',
      daysOfCoverage: '20',
      trendFactor: 1.5,
      seasonalityFactor: 1,
      targetStock: '60',
      reason: 'Reposição necessária, limitada ao estoque máximo configurado.',
    });
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('scopes suggestion history to the authenticated company and branch', async () => {
    const prisma = {
      purchaseSuggestion: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      purchaseSuggestionItem: { findMany: jest.fn() },
    };
    await new PurchaseSuggestionService(prisma as never).list(auth, {});
    expect(prisma.purchaseSuggestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: auth.companyId, branchId: auth.branchId } }),
    );
    expect(prisma.purchaseSuggestionItem.findMany).not.toHaveBeenCalled();
  });
});
