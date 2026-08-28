import { fiscalSettingSchema, nfceGatewayResponseSchema } from './fiscal.schemas';

describe('fiscal schemas', () => {
  it('accepts an authorized NFC-e response', () => {
    expect(
      nfceGatewayResponseSchema.parse({
        status: 'authorized',
        accessKey: '1'.repeat(44),
        protocol: '123',
        series: 1,
        number: 42,
        issuedAt: '2026-08-27T12:00:00Z',
        qrCodeUrl: 'https://sefaz.example/qrcode',
      }).number,
    ).toBe(42);
  });
  it('rejects a response that is not authorized', () => {
    expect(() => nfceGatewayResponseSchema.parse({ status: 'rejected' })).toThrow();
  });
  it('requires a certificate secret reference', () => {
    expect(() =>
      fiscalSettingSchema.parse({
        taxRegime: 'normal',
        environment: 'homologation',
        settings: {},
        validFrom: '2026-08-27',
      }),
    ).toThrow();
  });
});
