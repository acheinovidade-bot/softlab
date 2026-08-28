import {
  createBomSchema,
  finalizeProductionSchema,
  transitionProductionSchema,
} from './production.schemas';

const productId = '018f4f12-2222-7222-8222-111111111111';
const componentId = '018f4f12-2222-7222-8222-222222222222';
const unitId = '018f4f12-2222-7222-8222-333333333333';

describe('production schemas', () => {
  it('accepts a normalized BOM and rejects circular or repeated components', () => {
    expect(
      createBomSchema.parse({
        productId,
        yieldQuantity: '10',
        items: [{ componentProductId: componentId, unitId, quantity: '2' }],
      }).yieldQuantity,
    ).toBe(10);
    expect(() =>
      createBomSchema.parse({
        productId,
        yieldQuantity: 1,
        items: [{ componentProductId: productId, unitId, quantity: 1 }],
      }),
    ).toThrow();
    expect(() =>
      createBomSchema.parse({
        productId,
        yieldQuantity: 1,
        items: [
          { componentProductId: componentId, unitId, quantity: 1 },
          { componentProductId: componentId, unitId, quantity: 2 },
        ],
      }),
    ).toThrow();
  });
  it('enforces the workflow and valid manufacturing dates', () => {
    expect(() => transitionProductionSchema.parse({ toStatus: 'finalized' })).toThrow();
    expect(() =>
      finalizeProductionSchema.parse({
        locationId: unitId,
        producedQuantity: 1,
        lotNumber: 'L1',
        manufacturedAt: '2026-08-20',
        expiresAt: '2026-08-19',
        consumptions: [{ productId: componentId, quantity: 1 }],
      }),
    ).toThrow();
  });
});
