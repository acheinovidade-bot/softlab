import { adjustmentSchema, createLotSchema, fefoSchema, lotListSchema } from './stock.schemas';

describe('stock schemas', () => {
  it('accepts a positive quantity and explicit movement type', () => {
    expect(adjustmentSchema.parse({ productId: '018f4f12-2222-7222-8222-999999999999', locationId: '018f4f12-2222-7222-8222-888888888888', movementType: 'entry', quantity: '2.5', reason: 'Entrada manual conferida' }).quantity).toBe(2.5);
  });
  it('rejects zero quantities and invalid date ranges', () => {
    expect(() => adjustmentSchema.parse({ productId: '018f4f12-2222-7222-8222-999999999999', locationId: '018f4f12-2222-7222-8222-888888888888', movementType: 'exit', quantity: 0, reason: 'Saída manual' })).toThrow();
    expect(() => createLotSchema.parse({ productId: '018f4f12-2222-7222-8222-999999999999', lotNumber: 'L1', manufacturedAt: '2026-08-20', expiresAt: '2026-08-19' })).toThrow();
  });
  it('validates FEFO quantity and expiry filters', () => {
    expect(fefoSchema.parse({ quantity: '10' }).quantity).toBe(10); expect(lotListSchema.parse({ status: '30' }).status).toBe('30'); expect(() => fefoSchema.parse({ quantity: -1 })).toThrow();
  });
});
