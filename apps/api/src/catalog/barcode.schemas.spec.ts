import { barcodeSchema } from './barcode.schemas';

describe('barcodeSchema', () => {
  it('accepts a valid GTIN and rejects invalid check digits', () => {
    expect(barcodeSchema.parse('3017624010701')).toBe('3017624010701');
    expect(() => barcodeSchema.parse('3017624010702')).toThrow();
  });
  it('rejects unsupported barcode lengths', () => { expect(() => barcodeSchema.parse('123456789')).toThrow(); });
});
