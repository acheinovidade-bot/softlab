import { createBranchSchema, inviteUserSchema, updateUserAccessSchema } from './admin.schemas';

describe('admin schemas', () => {
  it('normalizes a branch code', () => {
    expect(createBranchSchema.parse({ code: ' matriz ', legalName: 'Empresa Matriz', taxId: '12345678000199' }).code).toBe('MATRIZ');
  });

  it('rejects malformed CNPJ', () => {
    expect(() => createBranchSchema.parse({ code: 'A', legalName: 'Empresa', taxId: '123' })).toThrow();
  });

  it('requires at least one branch and role when inviting', () => {
    expect(() => inviteUserSchema.parse({ email: 'user@example.com', displayName: 'User', branchIds: [], roleIds: [] })).toThrow();
  });

  it('rejects removing all access from a user', () => {
    expect(() => updateUserAccessSchema.parse({ branchIds: [], roleIds: [] })).toThrow();
  });
});
