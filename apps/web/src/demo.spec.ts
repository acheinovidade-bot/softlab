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

  it('requires a customer for credit and adds the sale to the customer statement', () => {
    const creditPayment = {
      paymentMethodId: '018f4f12-2222-7222-8222-000000000303',
      amount: '32.90',
    };
    expect(() =>
      demoResponse(
        '/sales/pos/checkout',
        'POST',
        JSON.stringify({
          customerId: null,
          items: [{ productId: 'p1', quantity: 1 }],
          payments: [creditPayment],
        }),
      ),
    ).toThrow('Selecione o cliente');

    const customerId = '018f4f12-2222-7222-8222-000000000101';
    const before = demoResponse(
      `/sales/pos/customers/${customerId}/statement?from=2026-08-01&to=2026-08-31`,
    ) as { coupons: unknown[] };
    const count = before.coupons.length;
    demoResponse(
      '/sales/pos/checkout',
      'POST',
      JSON.stringify({
        customerId,
        items: [{ productId: 'p1', quantity: 1 }],
        payments: [creditPayment],
      }),
    );
    const after = demoResponse(
      `/sales/pos/customers/${customerId}/statement?from=2026-08-01&to=2026-08-31`,
    ) as { coupons: Array<{ amountDue: string }> };
    expect(after.coupons).toHaveLength(count + 1);
    expect(after.coupons[0]?.amountDue).toBe('32.90');
  });
});
