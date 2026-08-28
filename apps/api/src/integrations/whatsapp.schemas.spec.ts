import { whatsappConfigSchema } from './whatsapp.schemas';

const valid = {
  status: 'active',
  provider: 'evolution',
  baseUrl: 'https://gateway.example.com/',
  instanceName: 'erp-filial-01',
  sendTextPath: '/message/sendText/{instance}',
  apiKeyEnvKey: 'WHATSAPP_GATEWAY_API_KEY_TENANT',
  webhookSecretEnvKey: 'WHATSAPP_GATEWAY_WEBHOOK_SECRET_TENANT',
};

describe('whatsappConfigSchema', () => {
  it('normalizes a safe Evolution configuration', () =>
    expect(whatsappConfigSchema.parse(valid).baseUrl).toBe('https://gateway.example.com'));
  it('rejects inline secrets and paths without instance isolation', () => {
    expect(() => whatsappConfigSchema.parse({ ...valid, apiKeyEnvKey: 'actual-secret' })).toThrow();
    expect(() =>
      whatsappConfigSchema.parse({ ...valid, sendTextPath: '/message/sendText' }),
    ).toThrow();
  });
});
