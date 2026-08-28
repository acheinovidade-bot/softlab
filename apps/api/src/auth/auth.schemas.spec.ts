import { changePasswordSchema, loginSchema } from './auth.schemas';

describe('authentication schemas', () => {
  it('normalizes login e-mail', () => {
    const result = loginSchema.parse({
      email: '  USER@Example.COM ', password: 'value',
      companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222',
    });
    expect(result.email).toBe('user@example.com');
  });

  it.each(['short', 'onlylowercase123!', 'ONLYUPPERCASE123!', 'NoNumbersHere!', 'NoSpecial123'])('rejects weak password %s', (newPassword) => {
    expect(() => changePasswordSchema.parse({ currentPassword: 'current', newPassword })).toThrow();
  });

  it('accepts a password that satisfies the policy', () => {
    expect(changePasswordSchema.parse({ currentPassword: 'current', newPassword: 'Strong!Password123' }).newPassword).toBe('Strong!Password123');
  });
});
