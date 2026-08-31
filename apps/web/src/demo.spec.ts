import { demoResponse } from './demo';

describe('demo customer persistence', () => {
  it('keeps the customer name entered in the PDV and exposes it in lookups', () => {
    const customer = demoResponse(
      '/master/customers',
      'POST',
      JSON.stringify({ legalName: 'Cliente cadastrado no caixa' }),
    ) as { id: string; legalName: string };
    const lookups = demoResponse('/sales/pos/lookups') as {
      customers: Array<{ id: string; name: string }>;
    };

    expect(customer.legalName).toBe('Cliente cadastrado no caixa');
    expect(lookups.customers).toContainEqual({
      id: customer.id,
      name: 'Cliente cadastrado no caixa',
    });
    expect(localStorage.getItem('erp:demo-pos-customers')).toContain('Cliente cadastrado no caixa');
  });
});
