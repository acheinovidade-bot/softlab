import { z } from 'zod';

const uuid = z.string().uuid();
const nullableUuid = uuid.nullable().default(null);
const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
const money = z.coerce.number().min(0).max(999_999_999_999);
export const catalogListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});
export const lookupKindSchema = z.enum(['groups', 'categories', 'brands', 'units', 'price-tables']);
export const createLookupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value) => value.toUpperCase())
    .optional(),
  parentId: uuid.nullable().optional(),
  decimalPlaces: z.coerce.number().int().min(0).max(6).optional(),
});
export const branchSettingSchema = z
  .object({
    branchId: uuid,
    minimumStock: z.coerce.number().min(0).default(0),
    maximumStock: z.coerce.number().min(0).nullable().default(null),
    locationLabel: nullableText(100),
    active: z.boolean().default(true),
  })
  .refine(
    ({ minimumStock, maximumStock }) => maximumStock === null || maximumStock >= minimumStock,
    { message: 'Estoque máximo deve ser maior ou igual ao mínimo', path: ['maximumStock'] },
  );
export const priceSchema = z
  .object({
    priceTableId: uuid,
    branchId: uuid.nullable().default(null),
    cost: money,
    salePrice: money,
    minimumPrice: money.nullable().default(null),
    commissionRate: z.coerce.number().min(0).max(100).default(0),
  })
  .refine(({ salePrice, minimumPrice }) => minimumPrice === null || minimumPrice <= salePrice, {
    message: 'Preço mínimo não pode superar o preço de venda',
    path: ['minimumPrice'],
  });
const productFields = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .transform((value) => value.toUpperCase()),
  barcode: z
    .string()
    .regex(/^\d{8,14}$/)
    .nullable()
    .default(null),
  description: z.string().trim().min(2).max(240),
  shortDescription: nullableText(120),
  groupId: nullableUuid,
  categoryId: nullableUuid,
  brandId: nullableUuid,
  unitId: uuid,
  reference: nullableText(80),
  productType: z.enum(['resale', 'manufactured', 'raw_material', 'service']).default('resale'),
  controlsLot: z.boolean().default(false),
  controlsExpiry: z.boolean().default(false),
  selectLotAtPos: z.boolean().default(false),
  allowsNegativeStock: z.boolean().default(false),
  openPrice: z.boolean().default(false),
  ncm: z
    .string()
    .regex(/^\d{8}$/)
    .nullable()
    .default(null),
  cest: z
    .string()
    .regex(/^\d{7}$/)
    .nullable()
    .default(null),
  origin: z.string().regex(/^\d$/).nullable().default(null),
  cfop: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .default(null),
  cst: z
    .string()
    .regex(/^\d{3}$/)
    .nullable()
    .default(null),
  csosn: z
    .string()
    .regex(/^\d{3}$/)
    .nullable()
    .default(null),
  taxProfile: z.record(z.string(), z.unknown()).nullable().default(null),
  deliveryEnabled: z.boolean().default(false),
  deliveryName: nullableText(160),
  deliveryDescription: nullableText(5000),
  deliveryPrice: money.nullable().default(null),
  printSector: z
    .enum(['kitchen', 'bar', 'pantry', 'grill', 'pizza', 'dispatch'])
    .nullable()
    .default(null),
  active: z.boolean().default(true),
});
export const createProductSchema = productFields
  .extend({ price: priceSchema, branchSettings: z.array(branchSettingSchema).max(100).default([]) })
  .refine(({ controlsExpiry, controlsLot }) => !controlsExpiry || controlsLot, {
    message: 'Controle de validade exige controle de lote',
    path: ['controlsExpiry'],
  })
  .refine(({ selectLotAtPos, controlsLot }) => !selectLotAtPos || controlsLot, {
    message: 'Seleção de lote no PDV exige controle de lote',
    path: ['selectLotAtPos'],
  });
export const updateProductSchema = productFields.partial();
