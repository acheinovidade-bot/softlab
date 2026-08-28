import { ForbiddenException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService webhook', () => {
  let updatedStatus = '';
  const config = {
    status: 'active',
    provider: 'evolution',
    baseUrl: 'https://gateway.example.com',
    instanceName: 'branch-1',
    sendTextPath: '/message/sendText/{instance}',
    apiKeyEnvKey: 'WHATSAPP_GATEWAY_TEST_KEY',
    webhookSecretEnvKey: 'WHATSAPP_GATEWAY_TEST_WEBHOOK',
  };
  const integration = {
    id: 'integration',
    companyId: 'company',
    branchId: 'branch',
    integrationType: 'whatsapp',
    provider: 'evolution',
    publicConfig: config,
  };
  const prisma = {
    integration: { findFirst: jest.fn().mockResolvedValue(integration) },
    whatsappMessage: {
      findFirst: jest.fn(),
      update: jest.fn((input: { data: { status: string } }) => {
        updatedStatus = input.data.status;
        return Promise.resolve({});
      }),
      create: jest.fn(),
    },
  };
  const service = new WhatsappService(prisma as never, {} as never, {} as never);
  beforeEach(() => {
    jest.clearAllMocks();
    updatedStatus = '';
    process.env.WHATSAPP_GATEWAY_TEST_WEBHOOK = 'shared-secret';
  });
  afterAll(() => delete process.env.WHATSAPP_GATEWAY_TEST_WEBHOOK);
  it('rejects an invalid shared secret', async () =>
    await expect(service.webhook('integration', 'wrong', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    ));
  it('updates an existing delivery event idempotently', async () => {
    prisma.whatsappMessage.findFirst.mockResolvedValue({ id: 'message', status: 'sent' });
    const result = await service.webhook('integration', 'shared-secret', {
      event: 'MESSAGES_UPDATE',
      data: { key: { id: 'provider-1', fromMe: true }, status: 'DELIVERY_ACK' },
    });
    expect(result).toEqual({ received: true, id: 'message' });
    expect(updatedStatus).toBe('delivered');
  });
});
