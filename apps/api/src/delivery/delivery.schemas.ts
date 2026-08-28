import { z } from 'zod';

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(8).max(30).nullable().default(null),
  employeeId: z.string().uuid().nullable().default(null),
});

export const createZoneSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    calculationType: z.enum(['neighborhood', 'postal_code', 'distance', 'radius']),
    values: z.array(z.string().trim().min(1).max(120)).max(100).default([]),
    maxDistanceKm: z.coerce.number().positive().max(500).nullable().default(null),
    centerLatitude: z.coerce.number().min(-90).max(90).nullable().default(null),
    centerLongitude: z.coerce.number().min(-180).max(180).nullable().default(null),
    fee: z.coerce.number().min(0).max(10000),
  })
  .superRefine((value, context) => {
    if (['neighborhood', 'postal_code'].includes(value.calculationType) && !value.values.length)
      context.addIssue({ code: 'custom', path: ['values'], message: 'Informe bairros ou CEPs' });
    if (['distance', 'radius'].includes(value.calculationType) && !value.maxDistanceKm)
      context.addIssue({
        code: 'custom',
        path: ['maxDistanceKm'],
        message: 'Informe a distância máxima',
      });
    if (
      value.calculationType === 'radius' &&
      (value.centerLatitude === null || value.centerLongitude === null)
    )
      context.addIssue({
        code: 'custom',
        path: ['centerLatitude'],
        message: 'Marque o centro do raio no mapa',
      });
  });

export const createDeliverySchema = z.object({
  orderId: z.string().uuid(),
  addressId: z.string().uuid(),
  distanceKm: z.coerce.number().min(0).max(500).nullable().default(null),
  promisedAt: z.coerce.date().nullable().default(null),
  latitude: z.coerce.number().min(-90).max(90).nullable().default(null),
  longitude: z.coerce.number().min(-180).max(180).nullable().default(null),
});

export const deliveryTransitionSchema = z.object({
  toStatus: z.enum([
    'confirmed',
    'preparing',
    'ready',
    'out_for_delivery',
    'delivered',
    'canceled',
  ]),
  driverId: z.string().uuid().nullable().default(null),
});
