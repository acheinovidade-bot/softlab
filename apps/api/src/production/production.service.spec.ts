import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { ProductionService } from './production.service';

const auth: AccessTokenPayload = {
  sub: '018f4f12-2222-7222-8222-000000000001',
  companyId: '018f4f12-2222-7222-8222-000000000002',
  branchId: '018f4f12-2222-7222-8222-000000000003',
  sessionId: 'session',
  permissions: [],
  modules: ['production'],
};
const orderId = '018f4f12-2222-7222-8222-000000000004';
const componentId = '018f4f12-2222-7222-8222-000000000005';
const outputId = '018f4f12-2222-7222-8222-000000000006';
const locationId = '018f4f12-2222-7222-8222-000000000007';

describe('ProductionService', () => {
  it('finalizes consumption, loss and output in one serializable transaction', async () => {
    const movements: Array<{ type: string; quantity: string }> = [];
    const tx = {
      productionOrder: {
        findFirst: jest.fn().mockResolvedValue({
          id: orderId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          bomId: 'bom',
          productId: outputId,
          status: 'quality',
          plannedQuantity: new Prisma.Decimal(10),
          producedQuantity: new Prisma.Decimal(0),
          qualityNotes: 'Aprovado',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockLocation: {
        findFirst: jest.fn().mockResolvedValue({ id: locationId, warehouseId: 'warehouse' }),
      },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'warehouse' }) },
      bomItem: { findMany: jest.fn().mockResolvedValue([{ componentProductId: componentId }]) },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: componentId,
            description: 'Insumo',
            controlsLot: false,
            allowsNegativeStock: false,
          },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: outputId, controlsExpiry: true }),
      },
      stockLot: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'lot-output', sourceId: orderId }),
      },
      stockBalance: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'input-balance',
            quantity: new Prisma.Decimal(20),
            reservedQuantity: new Prisma.Decimal(0),
          })
          .mockResolvedValueOnce(null),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      stockMovement: {
        create: jest.fn((input: { data: { movementType: string; quantity: Prisma.Decimal } }) => {
          movements.push({
            type: input.data.movementType,
            quantity: input.data.quantity.toString(),
          });
          return Promise.resolve({ id: `movement-${movements.length}` });
        }),
      },
      productionConsumption: { create: jest.fn().mockResolvedValue({}) },
      productionOutput: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new ProductionService(prisma as never);
    jest.spyOn(service, 'getOrder').mockResolvedValue({ finalized: true } as never);
    await service.finalize(auth, orderId, {
      locationId,
      producedQuantity: 9,
      lotNumber: 'OP-001',
      manufacturedAt: '2026-08-27',
      expiresAt: '2026-09-27',
      qualityNotes: 'Aprovado',
      consumptions: [{ productId: componentId, lotId: null, quantity: 5, lossQuantity: 1 }],
    });
    expect(movements).toEqual([
      { type: 'production_consumption', quantity: '-6' },
      { type: 'production_output', quantity: '9' },
    ]);
    expect(tx.productionConsumption.create).toHaveBeenCalledTimes(1);
    expect(tx.productionOutput.create).toHaveBeenCalledTimes(1);
    expect(tx.productionOrder.updateMany).toHaveBeenCalledTimes(1);
  });
});
