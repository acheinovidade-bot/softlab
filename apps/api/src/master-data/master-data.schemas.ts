import { z } from 'zod';

const uuid = z.string().uuid();
const nullableText = (max: number) => z.string().trim().max(max).nullable().default(null);
function validTaxId(value: string): boolean {
  if (/^(\d)\1+$/.test(value)) return false;
  if (value.length === 11) {
    const cpfDigit = (length: number): number => { let total = 0; for (let index = 0; index < length; index += 1) total += Number(value[index]) * (length + 1 - index); const digit = 11 - (total % 11); return digit >= 10 ? 0 : digit; };
    return cpfDigit(9) === Number(value[9]) && cpfDigit(10) === Number(value[10]);
  }
  const calculateCnpj = (length: number): number => {
    let factor = length - 7; let total = 0;
    for (let index = 0; index < length; index += 1) { total += Number(value[index]) * factor; factor -= 1; if (factor < 2) factor = 9; }
    const remainder = total % 11; return remainder < 2 ? 0 : 11 - remainder;
  };
  return calculateCnpj(12) === Number(value[12]) && calculateCnpj(13) === Number(value[13]);
}
const document = z.string().regex(/^(\d{11}|\d{14})$/).refine(validTaxId, 'CPF/CNPJ inválido');
export const cnpjLookupSchema = z.string().regex(/^\d{14}$/).refine(validTaxId, 'CNPJ inválido');
export const cepLookupSchema = z.string().regex(/^\d{8}$/, 'CEP deve conter 8 dígitos');
const taxId = document.nullable().default(null);
const cpf = z.string().length(11).refine(validTaxId, 'CPF inválido').nullable().default(null);
const contact = z.string().trim().regex(/^\+?[\d ()-]{8,30}$/).nullable().default(null);

export const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});

export const addressSchema = z.object({
  type: z.enum(['main', 'billing', 'delivery', 'other']).default('main'),
  isDefault: z.boolean().default(false), postalCode: z.string().regex(/^\d{8}$/).nullable().default(null),
  street: z.string().trim().min(2).max(180), number: nullableText(30), complement: nullableText(120),
  district: nullableText(120), city: z.string().trim().min(2).max(120), state: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  country: z.string().trim().length(2).default('BR').transform((value) => value.toUpperCase()),
});
export const addressesSchema = z.object({ addresses: z.array(addressSchema).max(20) }).superRefine(({ addresses }, context) => {
  if (addresses.filter(({ isDefault }) => isDefault).length > 1) context.addIssue({ code: 'custom', message: 'Somente um endereço pode ser o padrão' });
});

const customerFields = z.object({
  personType: z.enum(['F', 'J']), taxId, legalName: z.string().trim().min(2).max(200), tradeName: nullableText(200),
  phone: contact, whatsapp: contact, email: z.string().email().max(254).nullable().default(null),
  creditLimit: z.coerce.number().min(0).max(999_999_999_999).default(0), notes: nullableText(10_000), active: z.boolean().default(true),
});
export const createCustomerSchema = customerFields.extend({
  addresses: z.array(addressSchema).max(20).default([]),
}).superRefine(({ personType, taxId: value, addresses }, context) => {
  if (value && ((personType === 'F' && value.length !== 11) || (personType === 'J' && value.length !== 14))) context.addIssue({ code: 'custom', path: ['taxId'], message: 'CPF/CNPJ incompatível com o tipo de pessoa' });
  if (addresses.filter(({ isDefault }) => isDefault).length > 1) context.addIssue({ code: 'custom', path: ['addresses'], message: 'Somente um endereço pode ser o padrão' });
});
export const updateCustomerSchema = customerFields.partial();

export const createSupplierSchema = z.object({
  taxId, legalName: z.string().trim().min(2).max(200), tradeName: nullableText(200), email: z.string().email().max(254).nullable().default(null),
  phone: contact, averageLeadDays: z.coerce.number().int().min(0).max(3650).nullable().default(null), paymentTerms: nullableText(5000), active: z.boolean().default(true),
});
export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierProductsSchema = z.object({
  products: z.array(z.object({
    productId: uuid,
    supplierCode: nullableText(80),
    supplierDescription: nullableText(240),
  })).max(500),
}).superRefine(({ products }, context) => {
  const identifiers = products.map(({ productId }) => productId);
  if (new Set(identifiers).size !== identifiers.length) context.addIssue({ code: 'custom', path: ['products'], message: 'Um produto não pode ser vinculado duas vezes ao mesmo fornecedor' });
});

export const supplierProductSearchSchema = z.object({ search: z.string().trim().max(120).default('') });

export const createEmployeeSchema = z.object({
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()), name: z.string().trim().min(2).max(160),
  branchId: uuid.nullable().default(null), userId: uuid.nullable().default(null), taxId: cpf, jobTitle: nullableText(100), active: z.boolean().default(true),
});
export const updateEmployeeSchema = createEmployeeSchema.partial();
