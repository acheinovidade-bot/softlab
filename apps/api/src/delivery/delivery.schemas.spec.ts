import {
  createDeliverySchema,
  createZoneSchema,
  deliveryTransitionSchema,
} from './delivery.schemas';

describe('delivery schemas', () => {
  it('accepts neighborhood and distance delivery zones', () => {
    expect(
      createZoneSchema.parse({
        name: 'Centro',
        calculationType: 'neighborhood',
        values: ['Centro'],
        fee: 8,
      }).fee,
    ).toBe(8);
    expect(
      createZoneSchema.parse({
        name: 'Raio urbano',
        calculationType: 'distance',
        maxDistanceKm: 12,
        fee: 12.5,
      }).maxDistanceKm,
    ).toBe(12);
  });

  it('requires the rule values that match the calculation type', () => {
    expect(() =>
      createZoneSchema.parse({ name: 'Sem bairros', calculationType: 'neighborhood', fee: 5 }),
    ).toThrow();
    expect(() =>
      createZoneSchema.parse({ name: 'Sem raio', calculationType: 'radius', fee: 5 }),
    ).toThrow();
  });

  it('validates delivery creation and dispatch transitions', () => {
    const delivery = createDeliverySchema.parse({
      orderId: '11111111-1111-4111-8111-111111111111',
      addressId: '22222222-2222-4222-8222-222222222222',
      distanceKm: '4.5',
    });
    expect(delivery.distanceKm).toBe(4.5);
    expect(
      deliveryTransitionSchema.parse({
        toStatus: 'out_for_delivery',
        driverId: '33333333-3333-4333-8333-333333333333',
      }).toStatus,
    ).toBe('out_for_delivery');
  });
});
