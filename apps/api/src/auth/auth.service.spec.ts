import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

const config = new ConfigService({
  ACCESS_TOKEN_SECRET: 'test-secret-with-more-than-32-characters',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_DAYS: '30',
});

function createRepository() {
  return {
    findUserByEmail: jest.fn(), findUserById: jest.fn(), findActiveContext: jest.fn(),
    getPermissions: jest.fn(), createSession: jest.fn(), getSessionByRefreshHash: jest.fn(),
    rotateSession: jest.fn(), revokeSession: jest.fn(), hasActiveCompanyMembership: jest.fn(),
    createPasswordReset: jest.fn(), findPasswordReset: jest.fn(), replacePassword: jest.fn(),
    recordLoginAttempt: jest.fn(),
  };
}

describe('AuthService', () => {
  const redis = { consumeRateLimit: jest.fn().mockResolvedValue(true) };
  const saas = { getAccess: jest.fn().mockResolvedValue({ modules: [{ code: 'core' }] }) };

  beforeEach(() => jest.clearAllMocks());

  it('does not reveal whether an e-mail exists during login', async () => {
    const repository = createRepository();
    repository.findUserByEmail.mockResolvedValue(null);
    const service = new AuthService(repository as never, new JwtService(), config, redis as never, saas as never);
    await expect(service.login({
      email: 'none@example.com', password: 'anything',
      companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222',
    }, {})).rejects.toThrow(new UnauthorizedException('Credenciais inválidas'));
  });

  it('issues access and rotating refresh tokens for an authorized context', async () => {
    const repository = createRepository();
    const passwordHash = await argon2.hash('Correct!Password123', { type: argon2.argon2id });
    repository.findUserByEmail.mockResolvedValue({ id: '018f4f12-2222-7222-8222-333333333333', passwordHash });
    repository.findActiveContext.mockResolvedValue({ membership: { id: '018f4f12-2222-7222-8222-444444444444' }, branch: {} });
    repository.getPermissions.mockResolvedValue(['products.read']);
    repository.createSession.mockResolvedValue({});
    const jwt = new JwtService();
    const service = new AuthService(repository as never, jwt, config, redis as never, saas as never);
    const result = await service.login({
      email: 'user@example.com', password: 'Correct!Password123',
      companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222',
    }, { ip: '127.0.0.1' });
    expect(result.refreshToken.length).toBeGreaterThan(40);
    expect(repository.createSession).toHaveBeenCalledTimes(1);
    expect(jwt.verify(result.accessToken, { secret: config.getOrThrow('ACCESS_TOKEN_SECRET') })).toMatchObject({ permissions: ['products.read'], modules: ['core'] });
  });

  it('does not create a session for a company with a blocked subscription', async () => {
    const repository = createRepository();
    const passwordHash = await argon2.hash('Correct!Password123', { type: argon2.argon2id });
    repository.findUserByEmail.mockResolvedValue({ id: '018f4f12-2222-7222-8222-333333333333', passwordHash });
    repository.findActiveContext.mockResolvedValue({ membership: { id: '018f4f12-2222-7222-8222-444444444444' }, branch: {} });
    repository.getPermissions.mockResolvedValue([]);
    const blockedSaas = { getAccess: jest.fn().mockResolvedValue(null) };
    const service = new AuthService(repository as never, new JwtService(), config, redis as never, blockedSaas as never);
    await expect(service.login({ email: 'user@example.com', password: 'Correct!Password123', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222' }, {})).rejects.toThrow('Assinatura inativa, vencida ou bloqueada');
    expect(repository.createSession).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh session', async () => {
    const repository = createRepository();
    repository.getSessionByRefreshHash.mockResolvedValue({ revokedAt: null, expiresAt: new Date(0) });
    const service = new AuthService(repository as never, new JwtService(), config, redis as never, saas as never);
    await expect(service.refresh({ refreshToken: 'x'.repeat(64) })).rejects.toThrow('Sessão inválida ou expirada');
  });

  it('returns the same response for an unknown password recovery account', async () => {
    const repository = createRepository();
    repository.findUserByEmail.mockResolvedValue(null);
    const service = new AuthService(repository as never, new JwtService(), config, redis as never, saas as never);
    await expect(service.forgotPassword({
      email: 'none@example.com', companyId: '018f4f12-2222-7222-8222-111111111111',
    }, {})).resolves.toBeUndefined();
    expect(repository.createPasswordReset).not.toHaveBeenCalled();
  });
});
