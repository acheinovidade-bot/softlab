import { posCheckoutSchema, posSettingsSchema } from './pos.schemas';

const id = (suffix: string) => `018f4f12-2222-7222-8222-${suffix.padStart(12, '0')}`;
const checkout = {
  idempotencyKey: id('1'),
  sellerId: id('2'),
  locationId: id('3'),
  items: [{ productId: id('4'), quantity: '2', unitPrice: null, discount: '1.50' }],
  payments: [{ paymentMethodId: id('5'), amount: '18.50' }],
};

describe('POS checkout schema', () => {
  it('normalizes quantities, discounts and payments', () => {
    const parsed = posCheckoutSchema.parse(checkout);
    expect(parsed.items[0]).toMatchObject({ quantity: 2, unitPrice: null, discount: 1.5 });
    expect(parsed.payments[0]?.amount).toBe(18.5);
  });

  it('rejects repeated products and payment methods', () => {
    expect(() =>
      posCheckoutSchema.parse({ ...checkout, items: [...checkout.items, ...checkout.items] }),
    ).toThrow('Não repita produtos');
    expect(() =>
      posCheckoutSchema.parse({
        ...checkout,
        payments: [...checkout.payments, ...checkout.payments],
      }),
    ).toThrow('Não repita a forma de pagamento');
  });
  it('accepts a crediário due date and rejects an invalid date', () => {
    expect(
      posCheckoutSchema.parse({ ...checkout, creditDueDate: '2026-09-30' }).creditDueDate,
    ).toBe('2026-09-30');
    expect(() => posCheckoutSchema.parse({ ...checkout, creditDueDate: '30/09/2026' })).toThrow();
  });
});

describe('POS settings schema', () => {
  it('accepts branch defaults with an optional customer', () => {
    expect(
      posSettingsSchema.parse({
        defaultCustomerId: null,
        defaultSellerId: id('2'),
        defaultLocationId: id('3'),
      }),
    ).toEqual({
      defaultCustomerId: null,
      defaultSellerId: id('2'),
      defaultLocationId: id('3'),
    });
  });
});
