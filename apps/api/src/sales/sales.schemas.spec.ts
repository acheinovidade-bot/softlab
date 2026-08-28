import {
  allocateOrderSchema,
  createSalesQuoteSchema,
  orderTransitionSchema,
} from './sales.schemas';

const id = (suffix: string) => `018f4f12-2222-7222-8222-${suffix.padStart(12, '0')}`;
describe('sales schemas', () => {
  it('normalizes a quote and rejects repeated products', () => {
    const base = {
      sellerId: id('1'),
      paymentMethodId: id('2'),
      items: [{ productId: id('3'), quantity: '2' }],
    };
    expect(createSalesQuoteSchema.parse(base).items[0]?.quantity).toBe(2);
    expect(() =>
      createSalesQuoteSchema.parse({ ...base, items: [...base.items, ...base.items] }),
    ).toThrow();
  });
  it('accepts only known order stages and unique allocation rows', () => {
    expect(() => orderTransitionSchema.parse({ toStatus: 'anything' })).toThrow();
    expect(() =>
      allocateOrderSchema.parse({
        items: [
          { orderItemId: id('4'), locationId: id('5') },
          { orderItemId: id('4'), locationId: id('6') },
        ],
      }),
    ).toThrow();
  });
});
