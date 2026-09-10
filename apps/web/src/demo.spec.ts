import { demoResponse } from './demo';

describe('demo customer persistence', () => {
  it('loads customers with or without search parameters', () => {
    expect((demoResponse('/master/customers') as { items: unknown[] }).items.length).toBeGreaterThan(0);
    expect((demoResponse('/master/customers?search=Ana') as { items: unknown[] }).items.length).toBeGreaterThan(0);
  });

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

  it('preserves every customer field after save, edit and reload of the listing', () => {
    const customer = demoResponse('/master/customers', 'POST', JSON.stringify({
      personType: 'J', taxId: '12345678000199', legalName: 'Cliente Persistente Ltda.',
      tradeName: 'Cliente Persistente', phone: '85999990000', whatsapp: '85988880000',
      email: 'cliente.persistente@example.test', creditLimit: '2500.50',
      addresses: [{ type: 'main', isDefault: true, postalCode: '60123000', street: 'Rua Persistente',
        number: '77', complement: 'Sala 2', district: 'Centro', city: 'Fortaleza', state: 'CE', country: 'BR' }],
    })) as { id: string };

    demoResponse(`/master/customers/${customer.id}`, 'PATCH', JSON.stringify({ tradeName: 'Cliente Atualizado' }));
    const page = demoResponse('/master/customers?page=1&pageSize=20&search=Cliente%20Atualizado') as {
      items: Array<Record<string, unknown>>;
    };

    expect(page.items).toContainEqual(expect.objectContaining({
      id: customer.id, personType: 'J', taxId: '12345678000199',
      legalName: 'Cliente Persistente Ltda.', tradeName: 'Cliente Atualizado',
      phone: '85999990000', whatsapp: '85988880000',
      email: 'cliente.persistente@example.test', creditLimit: '2500.50', active: true,
    }));
    expect(localStorage.getItem('erp:demo-customers-v2')).toContain('cliente.persistente@example.test');
    const details = demoResponse(`/master/customers/${customer.id}`) as { addresses: Array<{ street: string; number: string }> };
    expect(details.addresses[0]).toMatchObject({ street: 'Rua Persistente', number: '77' });
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
    const checkout = demoResponse(
      '/sales/pos/checkout',
      'POST',
      JSON.stringify({
        customerId,
        items: [{ productId: 'p1', quantity: 1 }],
        payments: [creditPayment],
      }),
    ) as {
      credit: {
        customerName: string;
        saleCreditAmount: string;
        totalOpenAmount: string;
      };
    };
    const after = demoResponse(
      `/sales/pos/customers/${customerId}/statement?from=2026-08-01&to=2026-08-31`,
    ) as { coupons: Array<{ amountDue: string }> };
    expect(after.coupons).toHaveLength(count + 1);
    expect(after.coupons[0]?.amountDue).toBe('32.90');
    expect(checkout.credit.customerName).toBe('Ana Martins');
    expect(checkout.credit.saleCreditAmount).toBe('32.90');
    expect(Number(checkout.credit.totalOpenAmount)).toBeGreaterThanOrEqual(32.9);
  });
});
