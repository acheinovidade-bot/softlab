import { z } from 'zod';

const uuid = z.string().uuid();
const status = z.enum(['active', 'inactive']);

export const createBranchSchema = z.object({
  code: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional(),
  taxId: z.string().regex(/^\d{14}$/),
});
export const updateBranchSchema = createBranchSchema.partial().extend({ status: status.optional() });
export const createFiscalPosTerminalSchema = z.object({
  branchId: uuid,
  posNumber: z.coerce.number().int().positive().max(9999),
  description: z.string().trim().min(2).max(160),
  cashRegisterCode: z.string().trim().min(1).max(40).transform((value) => value.toUpperCase()),
  cscToken: z.string().trim().min(1).max(80),
  cscCode: z.string().trim().min(6).max(200),
  onlineSeries: z.string().trim().regex(/^\d{1,10}$/),
  offlineSeries: z.string().trim().regex(/^\d{1,10}$/),
  nfeSeries: z.string().trim().regex(/^\d{1,10}$/).default('1'),
}).refine((value) => value.onlineSeries !== value.offlineSeries, {
  message: 'As séries online e offline devem ser diferentes',
  path: ['offlineSeries'],
});
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
export const updateCompanyProfileSchema = z.object({
  taxId: z.string().regex(/^\d{14}$/),
  legalName: z.string().trim().min(2).max(200),
  tradeName: optionalText(200),
  stateRegistration: optionalText(40), municipalRegistration: optionalText(40),
  taxRegime: optionalText(40), cnae: optionalText(12), phone: optionalText(30),
  email: z.union([z.string().trim().email().max(254), z.literal(''), z.null()]).optional(),
  postalCode: z.union([z.string().regex(/^\d{8}$/), z.literal(''), z.null()]).optional(),
  street: optionalText(180), addressNumber: optionalText(30), complement: optionalText(120),
  district: optionalText(120), city: optionalText(120),
  state: z.union([z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/), z.literal(''), z.null()]).optional(),
});
export const createRoleSchema = z.object({
  code: z.string().trim().min(2).max(80).regex(/^[a-z0-9._-]+$/),
  name: z.string().trim().min(2).max(120),
});
export const updateRoleSchema = createRoleSchema.partial();
export const rolePermissionsSchema = z.object({ permissionIds: z.array(uuid).max(500) });
export const inviteUserSchema = z.object({
  email: z.preprocess((value) => typeof value === 'string' ? value.trim().toLowerCase() : value, z.string().email().max(254)),
  displayName: z.string().trim().min(2).max(160),
  branchIds: z.array(uuid).min(1).max(100),
  roleIds: z.array(uuid).min(1).max(100),
});
export const updateUserAccessSchema = z.object({
  branchIds: z.array(uuid).min(1).max(100),
  roleIds: z.array(uuid).min(1).max(100),
});
export const updateMembershipSchema = z.object({ status });
