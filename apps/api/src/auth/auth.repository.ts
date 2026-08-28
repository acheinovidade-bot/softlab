import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { uuidV7 } from '../common/uuid-v7';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUserByEmail(email: string) {
    return this.prisma.user.findFirst({ where: { email, status: 'active', deletedAt: null } });
  }

  findUserById(id: string) {
    return this.prisma.user.findFirst({ where: { id, status: 'active', deletedAt: null } });
  }

  async findActiveContext(userId: string, companyId: string, branchId: string) {
    const membership = await this.prisma.companyUser.findFirst({
      where: { userId, companyId, status: 'active' },
    });
    if (!membership) return null;
    const branchAccess = await this.prisma.userBranch.findFirst({
      where: { companyUserId: membership.id, branchId },
    });
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, status: 'active', deletedAt: null },
    });
    return branchAccess && branch ? { membership, branch } : null;
  }

  async hasActiveCompanyMembership(userId: string, companyId: string): Promise<boolean> {
    return Boolean(await this.prisma.companyUser.findFirst({ where: { userId, companyId, status: 'active' } }));
  }

  async getPermissions(companyUserId: string): Promise<string[]> {
    const roleLinks = await this.prisma.userRole.findMany({ where: { companyUserId }, select: { roleId: true } });
    const rolePermissionLinks = await this.prisma.rolePermission.findMany({
      where: { roleId: { in: roleLinks.map(({ roleId }) => roleId) } },
      select: { permissionId: true },
    });
    const direct = await this.prisma.userPermission.findMany({ where: { companyUserId } });
    const allowed = new Set(rolePermissionLinks.map(({ permissionId }) => permissionId));
    for (const override of direct) {
      if (override.allowed) allowed.add(override.permissionId);
      else allowed.delete(override.permissionId);
    }
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: [...allowed] } },
      select: { code: true },
    });
    return permissions.map(({ code }) => code).sort();
  }

  getSessionByRefreshHash(refreshTokenHash: string) {
    return this.prisma.session.findUnique({ where: { refreshTokenHash } });
  }

  createSession(data: {
    id: string; userId: string; companyId: string; branchId: string; refreshTokenHash: string;
    ip?: string; userAgent?: string; expiresAt: Date;
  }) {
    return this.prisma.session.create({ data: { ...data, createdAt: new Date(), updatedAt: new Date() } });
  }

  rotateSession(id: string, refreshTokenHash: string) {
    return this.prisma.session.update({ where: { id }, data: { refreshTokenHash, updatedAt: new Date() } });
  }

  revokeSession(id: string) {
    return this.prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: new Date(), updatedAt: new Date() } });
  }

  async createPasswordReset(userId: string, companyId: string, tokenHash: string, rawToken: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.create({
        data: { id: uuidV7(), userId, tokenHash, expiresAt: new Date(now.getTime() + 30 * 60_000), createdAt: now, updatedAt: now },
      }),
      this.prisma.outboxEvent.create({
        data: {
          id: uuidV7(), companyId, aggregateType: 'user', aggregateId: userId,
          eventType: 'auth.password_reset_requested', payload: { userId, token: rawToken }, occurredAt: now,
          attempts: 0, createdAt: now, updatedAt: now,
        },
      }),
    ]);
  }

  findPasswordReset(tokenHash: string) {
    return this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  }

  async recordLoginAttempt(data: {
    companyId?: string; branchId?: string; emailHash: string; success: boolean;
    userId?: string; failureReason?: string; ip?: string; userAgent?: string;
  }): Promise<void> {
    const now = new Date();
    await this.prisma.loginAttempt.create({
      data: { id: uuidV7(), ...data, occurredAt: now, createdAt: now, updatedAt: now },
    });
  }

  async replacePassword(userId: string, passwordHash: string, resetTokenId?: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash, passwordChangedAt: now, updatedAt: now } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now, updatedAt: now } });
      if (resetTokenId) await tx.passwordResetToken.update({ where: { id: resetTokenId }, data: { usedAt: now, updatedAt: now } });
    });
  }
}
