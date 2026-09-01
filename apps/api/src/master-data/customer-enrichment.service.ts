import { HttpException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload } from '../auth/auth.types';
import { RedisService } from '../infrastructure/redis/redis.service';
import { cepLookupSchema, cnpjLookupSchema } from './master-data.schemas';

interface BrasilApiCnpj {
  razao_social?: unknown; nome_fantasia?: unknown; ddd_telefone_1?: unknown; email?: unknown;
  cep?: unknown; logradouro?: unknown; numero?: unknown; complemento?: unknown; bairro?: unknown;
  municipio?: unknown; uf?: unknown; descricao_situacao_cadastral?: unknown;
  cnae_fiscal?: unknown; inscricoes_estaduais?: unknown;
}
interface BrasilApiCep { cep?: unknown; state?: unknown; city?: unknown; neighborhood?: unknown; street?: unknown }

@Injectable()
export class CustomerEnrichmentService {
  private readonly logger = new Logger(CustomerEnrichmentService.name);
  constructor(private readonly config: ConfigService, private readonly redis: RedisService) {}

  async lookupCnpj(auth: AccessTokenPayload, input: string) {
    const cnpj = cnpjLookupSchema.parse(input);
    await this.authorizeLookup(auth.companyId, 'cnpj');
    const response = await this.request(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (response.status === 404) return { cnpj, found: false, provider: 'brasilapi' as const, fields: null, sourceUrl: null, warnings: ['CNPJ não localizado. Continue o preenchimento manualmente.'] };
    if (!response.ok) throw new ServiceUnavailableException('Serviço de consulta de CNPJ indisponível');
    const data = await this.json<BrasilApiCnpj>(response);
    return {
      cnpj, found: true, provider: 'brasilapi' as const,
      fields: {
        legalName: this.clean(data.razao_social, 200), tradeName: this.clean(data.nome_fantasia, 200),
        phone: this.clean(data.ddd_telefone_1, 30), email: this.email(data.email), registrationStatus: this.clean(data.descricao_situacao_cadastral, 80),
        cnae: this.compactDigits(data.cnae_fiscal, 12), stateRegistration: this.stateRegistration(data.inscricoes_estaduais),
        address: this.address(data),
      },
      sourceUrl: `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
      warnings: ['Dados externos: confirme as informações antes de aplicar ao cadastro.'],
    };
  }

  async lookupCep(auth: AccessTokenPayload, input: string) {
    const cep = cepLookupSchema.parse(input);
    await this.authorizeLookup(auth.companyId, 'cep');
    const response = await this.request(`https://brasilapi.com.br/api/cep/v2/${cep}`);
    if (response.status === 404) return { cep, found: false, provider: 'brasilapi' as const, fields: null, sourceUrl: null, warnings: ['CEP não localizado. Continue o preenchimento manualmente.'] };
    if (!response.ok) throw new ServiceUnavailableException('Serviço de consulta de CEP indisponível');
    const data = await this.json<BrasilApiCep>(response);
    return {
      cep, found: true, provider: 'brasilapi' as const,
      fields: { postalCode: this.digits(data.cep, 8), street: this.clean(data.street, 180), district: this.clean(data.neighborhood, 120), city: this.clean(data.city, 120), state: this.state(data.state) },
      sourceUrl: `https://brasilapi.com.br/api/cep/v2/${cep}`,
      warnings: ['Confirme o endereço e informe número e complemento antes de salvar.'],
    };
  }

  private async authorizeLookup(companyId: string, kind: string): Promise<void> {
    if (this.config.get<string>('CUSTOMER_ENRICHMENT_PROVIDER') !== 'brasilapi') throw new ServiceUnavailableException('Consulta cadastral não configurada');
    try { if (!(await this.redis.consumeRateLimit(`customer-enrichment:${companyId}:${kind}`, 30, 60))) throw new HttpException('Limite de consultas cadastrais atingido', 429); }
    catch (error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException('Proteção de consultas temporariamente indisponível'); }
  }

  private async request(url: string): Promise<Response> {
    try {
      return await fetch(url, { headers: { accept: 'application/json', 'user-agent': this.config.getOrThrow<string>('BRASILAPI_USER_AGENT') }, signal: AbortSignal.timeout(this.config.get<number>('BRASILAPI_TIMEOUT_MS') ?? 5000) });
    } catch {
      this.logger.warn('Falha controlada ao consultar o provedor cadastral');
      throw new ServiceUnavailableException('Serviço de consulta cadastral indisponível');
    }
  }

  private async json<T>(response: Response): Promise<T> { try { return await response.json() as T; } catch { this.logger.warn('Resposta inválida recebida do provedor cadastral'); throw new ServiceUnavailableException('Resposta inválida do serviço de consulta cadastral'); } }

  private address(data: BrasilApiCnpj) { const postalCode = this.digits(data.cep, 8); const street = this.clean(data.logradouro, 180); const city = this.clean(data.municipio, 120); const state = this.state(data.uf); return postalCode && street && city && state ? { postalCode, street, number: this.clean(data.numero, 30), complement: this.clean(data.complemento, 120), district: this.clean(data.bairro, 120), city, state, country: 'BR' as const } : null; }
  private clean(value: unknown, max: number): string | null { if (typeof value !== 'string') return null; const clean = Array.from(value, (character) => { const code = character.charCodeAt(0); return code < 32 || code === 127 ? ' ' : character; }).join('').trim().slice(0, max); return clean || null; }
  private digits(value: unknown, length: number): string | null { const clean = typeof value === 'string' ? value.replace(/\D/g, '') : ''; return clean.length === length ? clean : null; }
  private compactDigits(value: unknown, max: number): string | null { const clean = typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\D/g, '') : ''; return clean.length > 0 && clean.length <= max ? clean : null; }
  private state(value: unknown): string | null { const clean = this.clean(value, 2)?.toUpperCase() ?? null; return clean && /^[A-Z]{2}$/.test(clean) ? clean : null; }
  private email(value: unknown): string | null { const clean = this.clean(value, 254)?.toLowerCase() ?? null; return clean && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ? clean : null; }
  private stateRegistration(value: unknown): string | null {
    if (!Array.isArray(value)) return null;
    for (const entry of value) {
      if (!entry || typeof entry !== 'object') continue;
      const registration = this.clean((entry as { inscricao_estadual?: unknown }).inscricao_estadual, 40);
      if (registration) return registration;
    }
    return null;
  }
}
