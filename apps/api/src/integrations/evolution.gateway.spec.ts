import { EvolutionGateway } from './evolution.gateway';

describe('EvolutionGateway', () => {
  const config = {
    status: 'active' as const,
    provider: 'evolution' as const,
    baseUrl: 'https://gateway.example.com',
    instanceName: 'branch-1',
    sendTextPath: '/message/sendText/{instance}',
    apiKeyEnvKey: 'WHATSAPP_GATEWAY_TEST_KEY',
    webhookSecretEnvKey: 'WHATSAPP_GATEWAY_TEST_WEBHOOK',
  };
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.WHATSAPP_GATEWAY_TEST_KEY;
  });
  it('sends plain text with the API key only in the header', async () => {
    process.env.WHATSAPP_GATEWAY_TEST_KEY = 'secret-key';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ key: { id: 'provider-1' } }),
    } as Response);
    const result = await new EvolutionGateway().send(config, {
      number: '5585999999999',
      text: 'Cotação COT-1',
    });
    expect(result.providerMessageId).toBe('provider-1');
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe('https://gateway.example.com/message/sendText/branch-1');
    const init = call?.[1];
    expect(new Headers(init?.headers).get('apikey')).toBe('secret-key');
    const body = typeof init?.body === 'string' ? init.body : '';
    expect(body).not.toContain('secret-key');
  });
});
