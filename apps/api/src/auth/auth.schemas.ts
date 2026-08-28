import { z } from 'zod';

const uuid = z.string().uuid();
const normalizedEmail = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z.string().email().max(254),
);
const password = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'A senha deve conter letra minúscula')
  .regex(/[A-Z]/, 'A senha deve conter letra maiúscula')
  .regex(/\d/, 'A senha deve conter número')
  .regex(/[^A-Za-z0-9]/, 'A senha deve conter caractere especial');

export const loginSchema = z.object({
  email: normalizedEmail,
  password: z.string().min(1).max(128),
  companyId: uuid,
  branchId: uuid,
});

export const refreshSchema = z.object({ refreshToken: z.string().min(40).max(512) });
export const logoutSchema = refreshSchema;
export const forgotPasswordSchema = z.object({
  email: normalizedEmail,
  companyId: uuid,
});
export const resetPasswordSchema = z.object({ token: z.string().min(40).max(512), newPassword: password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });

export type LoginInput = z.infer<typeof loginSchema>;
