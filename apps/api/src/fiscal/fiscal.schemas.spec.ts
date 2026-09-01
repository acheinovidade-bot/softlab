import {
  fiscalIssueSchema,
  fiscalSettingSchema,
  nfceGatewayResponseSchema,
  nfeGatewayResponseSchema,
} from './fiscal.schemas';

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
  it('accepts an authorized NF-e response without a consumer QR Code', () => {
    expect(
      nfeGatewayResponseSchema.parse({
        status: 'authorized',
        accessKey: '2'.repeat(44),
        protocol: '456',
        series: 1,
        number: 43,
        issuedAt: '2026-08-28T12:00:00Z',
      }).number,
    ).toBe(43);
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
  it('accepts a fiscal terminal link for NFC-e issuance', () => {
    expect(
      fiscalIssueSchema.parse({
        terminalId: '018f4f12-2222-7222-8222-000000000901',
        offline: true,
      }),
    ).toMatchObject({ offline: true });
  });
});
