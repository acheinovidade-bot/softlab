import { BadGatewayException, Injectable } from '@nestjs/common';
import type { WhatsappPublicConfig } from './whatsapp.schemas';

export interface TextMessage {
  number: string;
  text: string;
}
export interface GatewayResult {
  providerMessageId: string | null;
  payload: unknown;
}

@Injectable()
export class EvolutionGateway {
  async send(config: WhatsappPublicConfig, message: TextMessage): Promise<GatewayResult> {
    const apiKey = process.env[config.apiKeyEnvKey];
    if (!apiKey) throw new BadGatewayException(`Credencial ${config.apiKeyEnvKey} não configurada`);
    const path = config.sendTextPath.replace('{instance}', encodeURIComponent(config.instanceName));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: apiKey },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => ({ status: response.status }));
      if (!response.ok)
        throw new BadGatewayException(`Gateway WhatsApp recusou o envio (${response.status})`);
      return { providerMessageId: providerId(payload), payload };
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error ? error.message : 'Gateway WhatsApp indisponível',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function providerId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const key =
    value.key && typeof value.key === 'object' ? (value.key as Record<string, unknown>) : null;
  const data =
    value.data && typeof value.data === 'object' ? (value.data as Record<string, unknown>) : null;
  const id = key?.id ?? data?.id ?? value.id ?? value.messageId;
  return typeof id === 'string' ? id : null;
}
