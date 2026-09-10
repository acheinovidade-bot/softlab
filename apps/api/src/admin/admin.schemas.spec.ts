import { createBranchSchema, createFiscalPosTerminalSchema, inviteUserSchema, updateUserAccessSchema } from './admin.schemas';

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
  it('requires separate online and offline series for a fiscal PDV', () => {
    const input = {
      branchId: '018f4f12-2222-7222-8222-000000000003', posNumber: 1,
      description: 'Caixa principal', cashRegisterCode: 'caixa-01', cscToken: '1',
      cscCode: 'segredo', onlineSeries: '101', offlineSeries: '101',
    };
    expect(() => createFiscalPosTerminalSchema.parse(input)).toThrow('séries online e offline');
    expect(createFiscalPosTerminalSchema.parse({ ...input, offlineSeries: '901' }).cashRegisterCode)
      .toBe('CAIXA-01');
  });

  it('rejects removing all access from a user', () => {
    expect(() => updateUserAccessSchema.parse({ branchIds: [], roleIds: [] })).toThrow();
  });
});
