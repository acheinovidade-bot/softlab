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
