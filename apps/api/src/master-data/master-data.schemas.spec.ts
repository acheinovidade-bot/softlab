import { cepLookupSchema, cnpjLookupSchema, createCustomerSchema, createEmployeeSchema, listSchema } from './master-data.schemas';

describe('master data schemas', () => {
  it('normalizes paging and employee codes', () => {
    expect(listSchema.parse({ page: '2', pageSize: '25' })).toMatchObject({ page: 2, pageSize: 25, status: 'active' });
    expect(createEmployeeSchema.parse({ code: ' fun-1 ', name: 'Maria Silva' }).code).toBe('FUN-1');
  });

  it('rejects a CNPJ for a natural person', () => {
    expect(() => createCustomerSchema.parse({ personType: 'F', taxId: '11222333000181', legalName: 'Cliente Teste' })).toThrow();
  });

  it('validates document check digits', () => {
    expect(createCustomerSchema.parse({ personType: 'F', taxId: '52998224725', legalName: 'Cliente Teste' }).taxId).toBe('52998224725');
    expect(() => createCustomerSchema.parse({ personType: 'F', taxId: '52998224724', legalName: 'Cliente Teste' })).toThrow();
  });

  it('allows only one default customer address', () => {
    const address = { type: 'main', isDefault: true, street: 'Rua A', city: 'Fortaleza', state: 'CE' };
    expect(() => createCustomerSchema.parse({ personType: 'F', legalName: 'Cliente Teste', addresses: [address, address] })).toThrow();
  });

  it('validates CNPJ and CEP lookup inputs', () => {
    expect(cnpjLookupSchema.parse('11222333000181')).toBe('11222333000181');
    expect(cepLookupSchema.parse('60123000')).toBe('60123000');
    expect(() => cnpjLookupSchema.parse('11222333000182')).toThrow();
    expect(() => cepLookupSchema.parse('60123-000')).toThrow();
  });
});
