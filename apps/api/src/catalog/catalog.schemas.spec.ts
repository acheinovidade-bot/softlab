import { createProductSchema, priceSchema } from './catalog.schemas';

const base = {
  code: 'P1',
  description: 'Produto teste',
  unitId: '018f4f12-2222-7222-8222-111111111111',
  price: { priceTableId: '018f4f12-2222-7222-8222-222222222222', cost: 10, salePrice: 20 },
};
describe('catalog schemas', () => {
  it('normalizes product codes and accepts valid commercial data', () => {
    expect(createProductSchema.parse({ ...base, code: ' prod-1 ' }).code).toBe('PROD-1');
  });
  it('requires lot control when expiry is controlled', () => {
    expect(() => createProductSchema.parse({ ...base, controlsExpiry: true })).toThrow();
  });
  it('requires lot control for manual POS lot selection', () => {
    expect(() => createProductSchema.parse({ ...base, selectLotAtPos: true })).toThrow(
      'Seleção de lote no PDV exige controle de lote',
    );
  });
  it('rejects minimum price above sale price', () => {
    expect(() =>
      priceSchema.parse({
        priceTableId: base.price.priceTableId,
        cost: 10,
        salePrice: 20,
        minimumPrice: 21,
      }),
    ).toThrow();
  });
});
