import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import type { AccessTokenPayload } from '../auth/auth.types';
import { SaasService } from '../saas/saas.service';
import {
  createBranchSchema, createFiscalPosTerminalSchema, createRoleSchema, inviteUserSchema, rolePermissionsSchema,
  updateBranchSchema, updateCompanyProfileSchema, updateMembershipSchema, updateRoleSchema, updateUserAccessSchema,
} from './admin.schemas';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly saas: SaasService) {}

  getSubscription(auth: AccessTokenPayload) { return this.saas.getSummary(auth.companyId); }

  async getCompanyProfile(auth: AccessTokenPayload) {
    const company = await this.prisma.company.findFirst({
      where: { id: auth.companyId, deletedAt: null },
      select: { id: true, taxId: true, legalName: true, tradeName: true, timezone: true,
        stateRegistration: true, municipalRegistration: true, taxRegime: true, cnae: true,
        phone: true, email: true, postalCode: true, street: true, addressNumber: true,
        complement: true, district: true, city: true, state: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return company;
  }

  async updateCompanyProfile(auth: AccessTokenPayload, input: unknown) {
    const data = updateCompanyProfileSchema.parse(input);
    const before = await this.getCompanyProfile(auth);
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      const normalized = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value === '' ? null : value]));
      const after = await tx.company.update({ where: { id: auth.companyId }, data: { ...normalized, updatedAt: new Date() } });
      await this.audit(tx, auth, 'company.profile.update', 'company', auth.companyId, before, after);
      return after;
    }));
  }

  listBranches(auth: AccessTokenPayload) {
    return this.prisma.branch.findMany({ where: { companyId: auth.companyId, deletedAt: null }, orderBy: { code: 'asc' } });
  }

  async createBranch(auth: AccessTokenPayload, input: unknown) {
    const data = createBranchSchema.parse(input);
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      await this.saas.assertCapacity(tx, auth.companyId, 'branches');
      const now = new Date();
      const branch = await tx.branch.create({ data: { id: uuidV7(), companyId: auth.companyId, code: data.code, legalName: data.legalName, tradeName: data.tradeName ?? null, taxId: data.taxId, status: 'active', createdAt: now, updatedAt: now } });
      await this.audit(tx, auth, 'branch.create', 'branch', branch.id, null, branch);
      return branch;
    }));
  }

  async updateBranch(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = updateBranchSchema.parse(input);
    const before = await this.prisma.branch.findFirst({ where: { id, companyId: auth.companyId, deletedAt: null } });
    if (!before) throw new NotFoundException('Filial não encontrada');
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      if (data.status === 'active' && before.status !== 'active') await this.saas.assertCapacity(tx, auth.companyId, 'branches');
      const branch = await tx.branch.update({ where: { id }, data: {
        ...(data.code ? { code: data.code } : {}), ...(data.legalName ? { legalName: data.legalName } : {}),
        ...(data.tradeName !== undefined ? { tradeName: data.tradeName } : {}), ...(data.taxId ? { taxId: data.taxId } : {}),
        ...(data.status ? { status: data.status } : {}), updatedAt: new Date(),
      } });
      await this.audit(tx, auth, 'branch.update', 'branch', id, before, branch);
      return branch;
    }));
  }

  async listFiscalPosTerminals(auth: AccessTokenPayload) {
    const terminals = await this.prisma.fiscalPosTerminal.findMany({
      where: { companyId: auth.companyId },
      orderBy: [{ branchId: 'asc' }, { posNumber: 'asc' }],
      select: {
        id: true, branchId: true, posNumber: true, description: true, cashRegisterCode: true,
        cscToken: true, onlineSeries: true, offlineSeries: true, nfeSeries: true,
        lastOrderNumber: true, lastNfceNumber: true, lastNfceOfflineNumber: true, lastNfeNumber: true,
        active: true,
      },
    });
    return terminals.map((terminal) => ({ ...terminal,
      lastOrderNumber: terminal.lastOrderNumber.toString(), lastNfceNumber: terminal.lastNfceNumber.toString(),
      lastNfceOfflineNumber: terminal.lastNfceOfflineNumber.toString(), lastNfeNumber: terminal.lastNfeNumber.toString(),
    }));
  }

  async createFiscalPosTerminal(auth: AccessTokenPayload, input: unknown) {
    const data = createFiscalPosTerminalSchema.parse(input);
    const branch = await this.prisma.branch.findFirst({
      where: { id: data.branchId, companyId: auth.companyId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Filial não encontrada');
    return this.withUniqueConflict(async () => {
      const now = new Date();
      const terminal = await this.prisma.fiscalPosTerminal.create({
        data: {
          id: uuidV7(), companyId: auth.companyId, ...data, active: true,
          createdAt: now, updatedAt: now,
        },
        select: {
          id: true, branchId: true, posNumber: true, description: true, cashRegisterCode: true,
          cscToken: true, onlineSeries: true, offlineSeries: true, nfeSeries: true,
          lastOrderNumber: true, lastNfceNumber: true, lastNfceOfflineNumber: true, lastNfeNumber: true,
          active: true,
        },
      });
      return { ...terminal, lastOrderNumber: terminal.lastOrderNumber.toString(),
        lastNfceNumber: terminal.lastNfceNumber.toString(),
        lastNfceOfflineNumber: terminal.lastNfceOfflineNumber.toString(),
        lastNfeNumber: terminal.lastNfeNumber.toString() };
    });
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
  }

  async listRoles(auth: AccessTokenPayload) {
    const roles = await this.prisma.role.findMany({ where: { companyId: auth.companyId, deletedAt: null }, orderBy: { name: 'asc' } });
    const links = await this.prisma.rolePermission.findMany({ where: { roleId: { in: roles.map(({ id }) => id) } } });
    return roles.map((role) => ({ ...role, permissionIds: links.filter((link) => link.roleId === role.id).map((link) => link.permissionId) }));
  }

  async createRole(auth: AccessTokenPayload, input: unknown) {
    const data = createRoleSchema.parse(input);
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const role = await tx.role.create({ data: { id: uuidV7(), companyId: auth.companyId, ...data, createdAt: now, updatedAt: now } });
      await this.audit(tx, auth, 'role.create', 'role', role.id, null, role);
      return role;
    }));
  }

  async updateRole(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = updateRoleSchema.parse(input);
    const before = await this.getRole(auth.companyId, id);
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      const role = await tx.role.update({ where: { id }, data: { ...(data.code ? { code: data.code } : {}), ...(data.name ? { name: data.name } : {}), updatedAt: new Date() } });
      await this.audit(tx, auth, 'role.update', 'role', id, before, role);
      return role;
    }));
  }

  async replaceRolePermissions(auth: AccessTokenPayload, id: string, input: unknown): Promise<void> {
    const { permissionIds } = rolePermissionsSchema.parse(input);
    await this.getRole(auth.companyId, id);
    const count = await this.prisma.permission.count({ where: { id: { in: permissionIds } } });
    if (count !== new Set(permissionIds).size) throw new NotFoundException('Uma ou mais permissões não existem');
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.rolePermission.findMany({ where: { roleId: id }, select: { permissionId: true } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      const now = new Date();
      await tx.rolePermission.createMany({ data: [...new Set(permissionIds)].map((permissionId) => ({ id: uuidV7(), roleId: id, permissionId, createdAt: now, updatedAt: now })) });
      await this.audit(tx, auth, 'role.permissions.replace', 'role', id, before, permissionIds);
    });
  }

  async listUsers(auth: AccessTokenPayload) {
    const memberships = await this.prisma.companyUser.findMany({ where: { companyId: auth.companyId }, orderBy: { createdAt: 'desc' } });
    const users = await this.prisma.user.findMany({ where: { id: { in: memberships.map(({ userId }) => userId) } }, select: { id: true, email: true, displayName: true, status: true } });
    const branchLinks = await this.prisma.userBranch.findMany({ where: { companyUserId: { in: memberships.map(({ id }) => id) } } });
    const roleLinks = await this.prisma.userRole.findMany({ where: { companyUserId: { in: memberships.map(({ id }) => id) } } });
    return memberships.map((membership) => ({ ...membership, user: users.find(({ id }) => id === membership.userId), branchIds: branchLinks.filter((link) => link.companyUserId === membership.id).map((link) => link.branchId), roleIds: roleLinks.filter((link) => link.companyUserId === membership.id).map((link) => link.roleId) }));
  }

  async inviteUser(auth: AccessTokenPayload, input: unknown): Promise<{ companyUserId: string }> {
    const data = inviteUserSchema.parse(input);
    await this.validateAccessTargets(auth.companyId, data.branchIds, data.roleIds);
    const rawToken = randomBytes(48).toString('base64url');
    const passwordHash = await argon2.hash(randomBytes(48), { type: argon2.argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    return this.withUniqueConflict(async () => this.prisma.$transaction(async (tx) => {
      await this.saas.assertCapacity(tx, auth.companyId, 'users');
      const now = new Date();
      let user = await tx.user.findUnique({ where: { email: data.email } });
      const isNewUser = !user;
      if (!user) user = await tx.user.create({ data: { id: uuidV7(), email: data.email, displayName: data.displayName, passwordHash, status: 'active', mfaEnabled: false, createdAt: now, updatedAt: now } });
      const companyUser = await tx.companyUser.create({ data: { id: uuidV7(), companyId: auth.companyId, userId: user.id, status: 'active', createdAt: now, updatedAt: now } });
      await tx.userBranch.createMany({ data: [...new Set(data.branchIds)].map((branchId) => ({ id: uuidV7(), companyUserId: companyUser.id, branchId, createdAt: now, updatedAt: now })) });
      await tx.userRole.createMany({ data: [...new Set(data.roleIds)].map((roleId) => ({ id: uuidV7(), companyUserId: companyUser.id, roleId, createdAt: now, updatedAt: now })) });
      if (isNewUser) {
        await tx.passwordResetToken.create({ data: { id: uuidV7(), userId: user.id, tokenHash: this.hash(rawToken), expiresAt: new Date(now.getTime() + 24 * 3_600_000), createdAt: now, updatedAt: now } });
        await tx.outboxEvent.create({ data: { id: uuidV7(), companyId: auth.companyId, aggregateType: 'user', aggregateId: user.id, eventType: 'auth.user_invited', payload: { userId: user.id, token: rawToken }, occurredAt: now, attempts: 0, createdAt: now, updatedAt: now } });
      } else {
        await tx.outboxEvent.create({ data: { id: uuidV7(), companyId: auth.companyId, aggregateType: 'user', aggregateId: user.id, eventType: 'auth.user_added_to_company', payload: { userId: user.id }, occurredAt: now, attempts: 0, createdAt: now, updatedAt: now } });
      }
      await this.audit(tx, auth, 'user.invite', 'company_user', companyUser.id, null, { email: data.email, branchIds: data.branchIds, roleIds: data.roleIds });
      return { companyUserId: companyUser.id };
    }));
  }

  async updateMembership(auth: AccessTokenPayload, id: string, input: unknown): Promise<void> {
    const { status } = updateMembershipSchema.parse(input);
    const before = await this.getMembership(auth.companyId, id);
    await this.prisma.$transaction(async (tx) => {
      if (status === 'active' && before.status !== 'active') await this.saas.assertCapacity(tx, auth.companyId, 'users');
      const after = await tx.companyUser.update({ where: { id }, data: { status, updatedAt: new Date() } });
      if (status === 'inactive') await tx.session.updateMany({ where: { userId: before.userId, companyId: auth.companyId, revokedAt: null }, data: { revokedAt: new Date(), updatedAt: new Date() } });
      await this.audit(tx, auth, 'user.membership.update', 'company_user', id, before, after);
    });
  }

  async replaceUserAccess(auth: AccessTokenPayload, id: string, input: unknown): Promise<void> {
    const data = updateUserAccessSchema.parse(input);
    await this.getMembership(auth.companyId, id);
    await this.validateAccessTargets(auth.companyId, data.branchIds, data.roleIds);
    await this.prisma.$transaction(async (tx) => {
      const before = { branches: await tx.userBranch.findMany({ where: { companyUserId: id } }), roles: await tx.userRole.findMany({ where: { companyUserId: id } }) };
      await tx.userBranch.deleteMany({ where: { companyUserId: id } });
      await tx.userRole.deleteMany({ where: { companyUserId: id } });
      const now = new Date();
      await tx.userBranch.createMany({ data: [...new Set(data.branchIds)].map((branchId) => ({ id: uuidV7(), companyUserId: id, branchId, createdAt: now, updatedAt: now })) });
      await tx.userRole.createMany({ data: [...new Set(data.roleIds)].map((roleId) => ({ id: uuidV7(), companyUserId: id, roleId, createdAt: now, updatedAt: now })) });
      await this.audit(tx, auth, 'user.access.replace', 'company_user', id, before, data);
    });
  }

  private async validateAccessTargets(companyId: string, branchIds: string[], roleIds: string[]): Promise<void> {
    const [branches, roles] = await Promise.all([
      this.prisma.branch.count({ where: { companyId, id: { in: [...new Set(branchIds)] }, status: 'active', deletedAt: null } }),
      this.prisma.role.count({ where: { companyId, id: { in: [...new Set(roleIds)] }, deletedAt: null } }),
    ]);
    if (branches !== new Set(branchIds).size || roles !== new Set(roleIds).size) throw new NotFoundException('Filial ou perfil fora da empresa atual');
  }

  private async getRole(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!role) throw new NotFoundException('Perfil não encontrado');
    return role;
  }

  private async getMembership(companyId: string, id: string) {
    const membership = await this.prisma.companyUser.findFirst({ where: { id, companyId } });
    if (!membership) throw new NotFoundException('Usuário não encontrado na empresa');
    return membership;
  }

  private async audit(tx: Prisma.TransactionClient, auth: AccessTokenPayload, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<void> {
    const now = new Date();
    await tx.auditLog.create({ data: { id: uuidV7(), companyId: auth.companyId, branchId: auth.branchId, userId: auth.sub, action, entityType, entityId, ...(before === null ? {} : { beforeData: this.json(before) }), ...(after === null ? {} : { afterData: this.json(after) }), occurredAt: now, createdAt: now, updatedAt: now } });
  }

  private json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
  private hash(value: string): string { return createHash('sha256').update(value).digest('hex'); }
  private async withUniqueConflict<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Registro já existente'); throw error; }
  }
}
