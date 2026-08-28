import {
  BadGatewayException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { QuotationService } from '../purchases/quotation.service';
import { EvolutionGateway, type TextMessage } from './evolution.gateway';
import { whatsappConfigSchema } from './whatsapp.schemas';

@Injectable()
export class WhatsappService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quotations: QuotationService,
    private readonly gateway: EvolutionGateway,
  ) {}

  async getConfig(auth: AccessTokenPayload) {
    const integration = await this.integration(auth.companyId, auth.branchId);
    return integration ? this.expose(integration) : null;
  }

  async saveConfig(auth: AccessTokenPayload, input: unknown) {
    const config = whatsappConfigSchema.parse(input);
    if (process.env.NODE_ENV === 'production' && !config.baseUrl.startsWith('https://'))
      throw new ConflictException('O gateway deve usar HTTPS em produção');
    const existing = await this.integration(auth.companyId, auth.branchId);
    const now = new Date();
    const data = {
      provider: 'evolution',
      integrationType: 'whatsapp',
      status: config.status,
      publicConfig: this.json(config),
      secretReference: `${config.apiKeyEnvKey},${config.webhookSecretEnvKey}`,
      updatedAt: now,
    };
    const integration = existing
      ? await this.prisma.integration.update({ where: { id: existing.id }, data })
      : await this.prisma.integration.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            ...data,
            createdAt: now,
          },
        });
    await this.audit(auth, 'integration.whatsapp.configure', integration.id, {
      provider: config.provider,
      status: config.status,
      baseUrl: config.baseUrl,
      instanceName: config.instanceName,
    });
    return this.expose(integration);
  }

  async listMessages(auth: AccessTokenPayload) {
    const items = await this.prisma.whatsappMessage.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return {
      items: items.map((item) => this.summary(item)),
      total: items.length,
      page: 1,
      pageSize: 100,
    };
  }

  async sendQuotation(auth: AccessTokenPayload, quotationId: string, quotationSupplierId: string) {
    const integration = await this.requireActive(auth.companyId, auth.branchId);
    const detail = await this.quotations.get(auth, quotationId);
    const invitation = detail.suppliers.find(({ id }) => id === quotationSupplierId);
    if (!invitation) throw new NotFoundException('Fornecedor convidado não encontrado');
    const number = this.phone(invitation.supplier.phone);
    const link = await this.quotations.rotateLink(auth, quotationId, quotationSupplierId);
    const publicUrl = new URL(
      link.publicPath,
      process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173',
    ).toString();
    const supplierName = invitation.supplier.tradeName ?? invitation.supplier.legalName;
    const text = `Olá, ${supplierName}! A cotação ${detail.number} aguarda sua proposta até ${new Date(detail.responseDeadline).toLocaleDateString('pt-BR')}. Responda com segurança em: ${publicUrl}`;
    return this.dispatch(auth, integration, { number, text }, quotationSupplierId);
  }

  async retry(auth: AccessTokenPayload, id: string) {
    const record = await this.prisma.whatsappMessage.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId, direction: 'outbound' },
    });
    if (!record) throw new NotFoundException('Mensagem não encontrada');
    if (!['error', 'failed'].includes(record.status))
      throw new ConflictException('Somente mensagens com falha podem ser reenviadas');
    const integration = await this.requireActive(auth.companyId, auth.branchId);
    const payload = record.requestPayload as unknown as TextMessage;
    return this.dispatchExisting(auth, integration, record.id, payload);
  }

  async webhook(integrationId: string, suppliedSecret: string | undefined, payload: unknown) {
    const integration = await this.prisma.integration.findFirst({
      where: { id: integrationId, integrationType: 'whatsapp', provider: 'evolution' },
    });
    if (!integration) throw new NotFoundException('Integração não encontrada');
    const config = whatsappConfigSchema.parse(integration.publicConfig);
    const expected = process.env[config.webhookSecretEnvKey];
    if (!expected || !this.secureEqual(expected, suppliedSecret ?? ''))
      throw new ForbiddenException('Webhook não autorizado');
    const event = normalizeEvent(payload);
    if (!event.providerMessageId) return { received: true, ignored: true };
    const existing = await this.prisma.whatsappMessage.findFirst({
      where: { integrationId: integration.id, providerMessageId: event.providerMessageId },
    });
    if (existing) {
      const status = event.inbound ? 'responded' : normalizeStatus(event.status, existing.status);
      await this.prisma.whatsappMessage.update({
        where: { id: existing.id },
        data: statusData(status, payload),
      });
      return { received: true, id: existing.id };
    }
    if (event.inbound && integration.branchId) {
      const now = new Date();
      const created = await this.prisma.whatsappMessage.create({
        data: {
          id: uuidV7(),
          companyId: integration.companyId,
          branchId: integration.branchId,
          integrationId: integration.id,
          direction: 'inbound',
          recipient: event.remote,
          messageType: 'text',
          providerMessageId: event.providerMessageId,
          status: 'responded',
          requestPayload: this.json(payload),
          responsePayload: this.json(payload),
          attempts: 1,
          respondedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      return { received: true, id: created.id };
    }
    return { received: true, ignored: true };
  }

  private async dispatch(
    auth: AccessTokenPayload,
    integration: Awaited<ReturnType<WhatsappService['requireActive']>>,
    payload: TextMessage,
    quotationSupplierId: string,
  ) {
    const now = new Date();
    const record = await this.prisma.whatsappMessage.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        integrationId: integration.id,
        quotationSupplierId,
        direction: 'outbound',
        recipient: payload.number,
        messageType: 'text',
        status: 'created',
        requestPayload: this.json(payload),
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.dispatchExisting(auth, integration, record.id, payload);
  }

  private async dispatchExisting(
    auth: AccessTokenPayload,
    integration: Awaited<ReturnType<WhatsappService['requireActive']>>,
    id: string,
    payload: TextMessage,
  ) {
    const config = whatsappConfigSchema.parse(integration.publicConfig);
    try {
      const result = await this.gateway.send(config, payload);
      const now = new Date();
      const record = await this.prisma.whatsappMessage.update({
        where: { id },
        data: {
          providerMessageId: result.providerMessageId,
          status: 'sent',
          responsePayload: this.json(result.payload),
          errorCode: null,
          errorMessage: null,
          attempts: { increment: 1 },
          nextRetryAt: null,
          sentAt: now,
          updatedAt: now,
        },
      });
      await this.audit(auth, 'integration.whatsapp.send', record.id, {
        recipient: record.recipient,
        quotationSupplierId: record.quotationSupplierId,
      });
      return this.summary(record);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha no gateway';
      await this.prisma.whatsappMessage.update({
        where: { id },
        data: {
          status: 'error',
          errorCode: 'gateway_error',
          errorMessage: message,
          attempts: { increment: 1 },
          nextRetryAt: new Date(Date.now() + 300_000),
          failedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      throw error instanceof BadGatewayException ? error : new BadGatewayException(message);
    }
  }

  private integration(companyId: string, branchId: string) {
    return this.prisma.integration.findFirst({
      where: { companyId, branchId, provider: 'evolution', integrationType: 'whatsapp' },
    });
  }
  private async requireActive(companyId: string, branchId: string) {
    const value = await this.integration(companyId, branchId);
    if (!value || value.status !== 'active')
      throw new ConflictException('Gateway WhatsApp não configurado ou inativo');
    return value;
  }
  private expose(value: { id: string; status: string; publicConfig: Prisma.JsonValue }) {
    const config = whatsappConfigSchema.parse(value.publicConfig);
    return { id: value.id, ...config, webhookPath: `/api/v1/public/webhooks/whatsapp/${value.id}` };
  }
  private phone(value: string | null) {
    const digits = value?.replace(/\D/g, '') ?? '';
    if (!/^\d{8,15}$/.test(digits))
      throw new ConflictException('Fornecedor sem WhatsApp válido (8 a 15 dígitos)');
    return digits;
  }
  private summary(item: {
    id: string;
    direction: string;
    recipient: string;
    messageType: string;
    providerMessageId: string | null;
    status: string;
    attempts: number;
    errorMessage: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
    readAt: Date | null;
    respondedAt: Date | null;
    createdAt: Date;
  }) {
    return item;
  }
  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
  private secureEqual(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  private audit(auth: AccessTokenPayload, action: string, entityId: string, afterData: unknown) {
    const now = new Date();
    return this.prisma.auditLog.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        userId: auth.sub,
        action,
        entityType: 'whatsapp_message',
        entityId,
        afterData: this.json(afterData),
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

function normalizeEvent(payload: unknown) {
  const root = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const data =
    root.data && typeof root.data === 'object' ? (root.data as Record<string, unknown>) : root;
  const key = data.key && typeof data.key === 'object' ? (data.key as Record<string, unknown>) : {};
  const event = text(root.event ?? root.type).toLowerCase();
  return {
    providerMessageId:
      typeof key.id === 'string' ? key.id : typeof data.id === 'string' ? data.id : null,
    remote: text(key.remoteJid ?? data.remoteJid, 'unknown'),
    status: text(data.status ?? root.status),
    inbound:
      key.fromMe === false ||
      (key.fromMe === undefined &&
        (event.includes('messages.upsert') || event.includes('messages_upsert'))),
  };
}
function text(value: unknown, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}
function normalizeStatus(value: string, fallback: string) {
  const status = value.toUpperCase();
  if (status.includes('READ')) return 'read';
  if (status.includes('DELIVERY')) return 'delivered';
  if (status.includes('ERROR') || status.includes('FAIL')) return 'failed';
  if (status.includes('ACK') || status.includes('SENT')) return 'sent';
  return fallback;
}
function statusData(status: string, payload: unknown) {
  const now = new Date();
  return {
    status,
    responsePayload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue,
    updatedAt: now,
    ...(status === 'sent' ? { sentAt: now } : {}),
    ...(status === 'delivered' ? { deliveredAt: now } : {}),
    ...(status === 'read' ? { readAt: now } : {}),
    ...(status === 'responded' ? { respondedAt: now } : {}),
    ...(status === 'failed' ? { failedAt: now } : {}),
  };
}
