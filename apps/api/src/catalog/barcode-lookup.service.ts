import { HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../auth/auth.types';
import { RedisService } from '../infrastructure/redis/redis.service';
import { barcodeSchema } from './barcode.schemas';

interface OpenFoodFactsResponse { status?: string | number; product?: { code?: string; product_name?: string; abbreviated_product_name?: string; brands?: string; image_front_url?: string; quantity?: string } }

@Injectable()
export class BarcodeLookupService {
  private readonly logger = new Logger(BarcodeLookupService.name);
  constructor(private readonly config: ConfigService, private readonly redis: RedisService) {}

  async lookup(auth: AccessTokenPayload, barcodeInput: string) {
    const barcode = barcodeSchema.parse(barcodeInput);
    if (this.config.get<string>('BARCODE_LOOKUP_PROVIDER') !== 'openfoodfacts') throw new ServiceUnavailableException('Consulta por código de barras não configurada');
    try { if (!(await this.redis.consumeRateLimit(`barcode:${auth.companyId}`, 60, 60))) throw new HttpException('Limite de consultas por código de barras atingido', 429); }
    catch (error) { if (error instanceof HttpException && error.getStatus() === 429) throw error; throw new ServiceUnavailableException('Controle de consultas temporariamente indisponível'); }
    const userAgent = this.config.getOrThrow<string>('OPENFOODFACTS_USER_AGENT'); const timeout = this.config.get<number>('BARCODE_LOOKUP_TIMEOUT_MS') ?? 5000;
    const fields = 'code,product_name,abbreviated_product_name,brands,image_front_url,quantity';
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v3/product/${barcode}.json?fields=${fields}`, { headers: { 'user-agent': userAgent, accept: 'application/json' }, signal: AbortSignal.timeout(timeout) });
      if (response.status === 404) return this.notFound(barcode);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as OpenFoodFactsResponse; const product = body.product;
      if (!product || body.status === 0 || body.status === 'failure') return this.notFound(barcode);
      return { barcode, found: true, provider: 'openfoodfacts' as const, confidence: 'community' as const, fields: { description: this.clean(product.product_name, 240), shortDescription: this.clean(product.abbreviated_product_name, 120), brandName: this.clean(product.brands?.split(',')[0], 120), imageUrl: this.safeImage(product.image_front_url), quantityLabel: this.clean(product.quantity, 80), ncm: null }, sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`, warnings: ['Dados comunitários: confirme as informações antes de aplicar.', 'Classificação fiscal não é fornecida por este provedor.'] };
    } catch (error) { this.logger.warn(`Barcode provider failed: ${error instanceof Error ? error.message : 'unknown error'}`); throw new ServiceUnavailableException('Provedor de código de barras temporariamente indisponível'); }
  }
  private notFound(barcode: string) { return { barcode, found: false, provider: 'openfoodfacts' as const, confidence: 'none' as const, fields: null, sourceUrl: null, warnings: ['Produto não localizado. Continue o cadastro manualmente.'] }; }
  private clean(value: string | undefined, max: number): string | null { const clean = value?.trim().replace(/\s+/g, ' '); return clean ? clean.slice(0, max) : null; }
  private safeImage(value: string | undefined): string | null { if (!value) return null; try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; } }
}
