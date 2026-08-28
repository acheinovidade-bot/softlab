import { createHash, randomBytes } from 'node:crypto';
import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { uuidV7 } from '../common/uuid-v7';
import { RedisService } from '../infrastructure/redis/redis.service';
import { AuthRepository } from './auth.repository';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
} from './auth.schemas';
import type { AccessTokenPayload, RequestMetadata } from './auth.types';
import { SaasService } from '../saas/saas.service';

@Injectable()
export class AuthService {
  private static readonly DUMMY_PASSWORD_HASH = '$argon2id$v=19$m=65536,t=3,p=1$CXPjiiSu0a/OOKqeW/9kCA$WLyAe/lVz2CuNEzd6dbkkH65HKuE55wDQ7ySEuxqjnw';
  private readonly secret: string;
  private readonly accessTokenSeconds: number;
  private readonly refreshTokenDays: number;

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly saas: SaasService,
  ) {
    this.secret = this.config.getOrThrow<string>('ACCESS_TOKEN_SECRET');
    this.accessTokenSeconds = this.parseDuration(this.config.get<string>('ACCESS_TOKEN_TTL') ?? '15m');
    this.refreshTokenDays = Number(this.config.get<string>('REFRESH_TOKEN_DAYS') ?? '30');
  }

  async login(input: unknown, metadata: RequestMetadata) {
    const data = loginSchema.parse(input);
    await this.enforceLoginRateLimit(data.email, metadata.ip);
    const user = await this.repository.findUserByEmail(data.email);
    const validPassword = await argon2.verify(user?.passwordHash ?? AuthService.DUMMY_PASSWORD_HASH, data.password);
    if (!user || !validPassword) {
      await this.repository.recordLoginAttempt({
        emailHash: this.hashToken(data.email), success: false,
        failureReason: 'invalid_credentials', ...(metadata.ip ? { ip: metadata.ip } : {}), ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      });
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const context = await this.repository.findActiveContext(user.id, data.companyId, data.branchId);
    if (!context) {
      await this.repository.recordLoginAttempt({
        userId: user.id, emailHash: this.hashToken(data.email), success: false,
        failureReason: 'context_denied', ...(metadata.ip ? { ip: metadata.ip } : {}), ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
      });
      throw new UnauthorizedException('Empresa ou filial não autorizada');
    }
    const permissions = await this.repository.getPermissions(context.membership.id);
    const subscription = await this.saas.getAccess(data.companyId);
    if (!subscription) throw new UnauthorizedException('Assinatura inativa, vencida ou bloqueada');
    const refreshToken = this.createOpaqueToken();
    const sessionId = uuidV7();
    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      companyId: data.companyId,
      branchId: data.branchId,
      refreshTokenHash: this.hashToken(refreshToken),
      ...(metadata.ip ? { ip: metadata.ip } : {}),
      ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 1000) } : {}),
      expiresAt: new Date(Date.now() + this.refreshTokenDays * 86_400_000),
    });
    await this.repository.recordLoginAttempt({
      companyId: data.companyId, branchId: data.branchId, userId: user.id, emailHash: this.hashToken(data.email), success: true,
      ...(metadata.ip ? { ip: metadata.ip } : {}), ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
    });
    return this.issueTokens(user.id, data.companyId, data.branchId, sessionId, permissions, subscription.modules.map(({ code }) => code), refreshToken);
  }

  async refresh(input: unknown) {
    const { refreshToken } = refreshSchema.parse(input);
    const session = await this.repository.getSessionByRefreshHash(this.hashToken(refreshToken));
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedException('Sessão inválida ou expirada');
    const user = await this.repository.findUserById(session.userId);
    if (!user) throw new UnauthorizedException('Usuário inativo');
    const context = await this.repository.findActiveContext(user.id, session.companyId, session.branchId);
    if (!context) throw new UnauthorizedException('Contexto de acesso revogado');
    const permissions = await this.repository.getPermissions(context.membership.id);
    const subscription = await this.saas.getAccess(session.companyId);
    if (!subscription) throw new UnauthorizedException('Assinatura inativa, vencida ou bloqueada');
    const rotatedToken = this.createOpaqueToken();
    await this.repository.rotateSession(session.id, this.hashToken(rotatedToken));
    return this.issueTokens(user.id, session.companyId, session.branchId, session.id, permissions, subscription.modules.map(({ code }) => code), rotatedToken);
  }

  async logout(input: unknown): Promise<void> {
    const { refreshToken } = refreshSchema.parse(input);
    const session = await this.repository.getSessionByRefreshHash(this.hashToken(refreshToken));
    if (session) await this.repository.revokeSession(session.id);
  }

  async forgotPassword(input: unknown, metadata: RequestMetadata): Promise<void> {
    const data = forgotPasswordSchema.parse(input);
    await this.enforceLoginRateLimit(`reset:${data.email}`, metadata.ip);
    const user = await this.repository.findUserByEmail(data.email);
    if (!user) return;
    if (!(await this.repository.hasActiveCompanyMembership(user.id, data.companyId))) return;
    const rawToken = this.createOpaqueToken();
    await this.repository.createPasswordReset(user.id, data.companyId, this.hashToken(rawToken), rawToken);
  }

  async resetPassword(input: unknown): Promise<void> {
    const data = resetPasswordSchema.parse(input);
    const reset = await this.repository.findPasswordReset(this.hashToken(data.token));
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) throw new UnauthorizedException('Token de recuperação inválido ou expirado');
    await this.repository.replacePassword(reset.userId, await this.hashPassword(data.newPassword), reset.id);
  }

  async changePassword(userId: string, input: unknown): Promise<void> {
    const data = changePasswordSchema.parse(input);
    const user = await this.repository.findUserById(userId);
    if (!user || !(await argon2.verify(user.passwordHash, data.currentPassword))) throw new UnauthorizedException('Senha atual inválida');
    await this.repository.replacePassword(user.id, await this.hashPassword(data.newPassword));
  }

  async me(payload: AccessTokenPayload) {
    const user = await this.repository.findUserById(payload.sub);
    if (!user) throw new UnauthorizedException('Usuário inativo');
    return { id: user.id, email: user.email, displayName: user.displayName, companyId: payload.companyId, branchId: payload.branchId, permissions: payload.permissions, modules: payload.modules };
  }

  private async issueTokens(userId: string, companyId: string, branchId: string, sessionId: string, permissions: string[], modules: string[], refreshToken: string) {
    const payload: AccessTokenPayload = { sub: userId, companyId, branchId, sessionId, permissions, modules };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.secret, expiresIn: this.accessTokenSeconds });
    return { accessToken, refreshToken, tokenType: 'Bearer', expiresIn: this.accessTokenSeconds };
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  }

  private createOpaqueToken(): string { return randomBytes(48).toString('base64url'); }
  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }

  private async enforceLoginRateLimit(identity: string, ip?: string): Promise<void> {
    try {
      const allowed = await this.redis.consumeRateLimit(`auth:${ip ?? 'unknown'}:${this.hashToken(identity)}`, 8, 15 * 60);
      if (!allowed) throw new UnauthorizedException('Muitas tentativas. Tente novamente mais tarde');
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException('Serviço de autenticação temporariamente indisponível');
    }
  }

  private parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) throw new Error('ACCESS_TOKEN_TTL inválido');
    const amount = Number(match[1]);
    const unit = match[2];
    return amount * ({ s: 1, m: 60, h: 3600, d: 86_400 }[unit ?? 's'] ?? 1);
  }
}
