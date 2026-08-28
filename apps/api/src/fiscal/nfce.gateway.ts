import { BadGatewayException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { nfceGatewayResponseSchema } from './fiscal.schemas';

@Injectable()
export class NfceGateway {
  constructor(private readonly config: ConfigService) {}

  async issue(payload: unknown, idempotencyKey: string) {
    const baseUrl = this.config.get<string>('NFCE_GATEWAY_URL');
    const token = this.config.get<string>('NFCE_GATEWAY_TOKEN');
    if (!baseUrl || !token)
      throw new ConflictException(
        'Hub NFC-e não configurado. Informe NFCE_GATEWAY_URL e NFCE_GATEWAY_TOKEN.',
      );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/nfce/issue`, {
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
        throw new BadGatewayException(`Hub NFC-e recusou a emissão (${response.status})`);
      const parsed = nfceGatewayResponseSchema.safeParse(body);
      if (!parsed.success)
        throw new BadGatewayException(
          'Resposta inválida do hub NFC-e; documento não foi autorizado',
        );
      return parsed.data;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error ? error.message : 'Hub NFC-e indisponível',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
