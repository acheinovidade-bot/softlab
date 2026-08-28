import {
  createQuotationSchema,
  quotationListSchema,
  quotationResponseSchema,
} from './quotation.schemas';

describe('quotation schemas', () => {
  it('validates creation and supplier response limits', () => {
    expect(
      createQuotationSchema.parse({
        suggestionId: '018f4f12-2222-7222-8222-555555555555',
        responseDeadline: '2026-09-01T12:00:00.000Z',
      }).responseDeadline,
    ).toBeInstanceOf(Date);
    expect(() => quotationResponseSchema.parse({ items: [] })).toThrow();
    expect(() =>
      quotationResponseSchema.parse({
        items: [
          {
            quotationItemId: '018f4f12-2222-7222-8222-555555555555',
            offeredQuantity: -1,
            unitPrice: 2,
          },
        ],
      }),
    ).toThrow();
  });
  it('rejects duplicated response items and oversized pages', () => {
    const item = {
      quotationItemId: '018f4f12-2222-7222-8222-555555555555',
      offeredQuantity: 1,
      unitPrice: 2,
    };
    expect(() => quotationResponseSchema.parse({ items: [item, item] })).toThrow();
    expect(() => quotationListSchema.parse({ pageSize: 101 })).toThrow();
  });
});
