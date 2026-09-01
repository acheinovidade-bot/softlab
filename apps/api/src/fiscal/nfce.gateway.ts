import { BadGatewayException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nfceGatewayResponseSchema, nfeGatewayResponseSchema } from './fiscal.schemas';

@Injectable()
export class NfceGateway {
  constructor(private readonly config: ConfigService) {}

  async issue(payload: unknown, idempotencyKey: string) {
    return this.request('nfce', payload, idempotencyKey);
  }

  async issueNfe(payload: unknown, idempotencyKey: string) {
    return this.request('nfe', payload, idempotencyKey);
  }

  private async request(kind: 'nfce' | 'nfe', payload: unknown, idempotencyKey: string) {
    const prefix = kind === 'nfe' ? 'NFE' : 'NFCE';
    const baseUrl = this.config.get<string>(`${prefix}_GATEWAY_URL`);
    const token = this.config.get<string>(`${prefix}_GATEWAY_TOKEN`);
    if (!baseUrl || !token)
      throw new ConflictException(
        `Hub ${kind === 'nfe' ? 'NF-e' : 'NFC-e'} não configurado. Informe ${prefix}_GATEWAY_URL e ${prefix}_GATEWAY_TOKEN.`,
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/${kind}/issue`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => ({ status: response.status }));
      if (!response.ok)
        throw new BadGatewayException(
          `Hub ${kind === 'nfe' ? 'NF-e' : 'NFC-e'} recusou a emissão (${response.status})`,
        );
      const parsed = (
        kind === 'nfe' ? nfeGatewayResponseSchema : nfceGatewayResponseSchema
      ).safeParse(body);
      if (!parsed.success)
        throw new BadGatewayException(
          `Resposta inválida do hub ${kind === 'nfe' ? 'NF-e' : 'NFC-e'}; documento não foi autorizado`,
        );
      return parsed.data;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error
          ? error.message
          : `Hub ${kind === 'nfe' ? 'NF-e' : 'NFC-e'} indisponível`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
