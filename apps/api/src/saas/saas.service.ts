import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../infrastructure/database/prisma.service';

type Capacity = 'users' | 'branches';
type Database = PrismaService | Prisma.TransactionClient;

@Injectable()
export class SaasService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccess(companyId: string, database: Database = this.prisma) {
    const now = new Date();
    const subscription = await database.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    if (!subscription || subscription.blockedAt || !['trial', 'active'].includes(subscription.status) || subscription.currentPeriodEnd <= now) return null;
    if (subscription.status === 'trial' && (!subscription.trialEndsAt || subscription.trialEndsAt <= now)) return null;
    const [plan, planLinks, overrides] = await Promise.all([
      database.saasPlan.findUnique({ where: { id: subscription.planId } }),
      database.planModule.findMany({ where: { planId: subscription.planId }, select: { moduleId: true } }),
      database.subscriptionModule.findMany({ where: { subscriptionId: subscription.id }, select: { moduleId: true, enabled: true } }),
    ]);
    if (!plan?.active) return null;
    const enabledIds = new Set(planLinks.map(({ moduleId }) => moduleId));
    for (const override of overrides) {
      if (override.enabled) enabledIds.add(override.moduleId);
      else enabledIds.delete(override.moduleId);
    }
    const modules = await database.saasModule.findMany({ where: { id: { in: [...enabledIds] }, active: true }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
    return { subscription, plan, modules };
  }

  async getSummary(companyId: string) {
    const access = await this.getAccess(companyId);
    const subscription = access?.subscription ?? await this.prisma.subscription.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } });
    if (!subscription) throw new ForbiddenException('Empresa sem assinatura');
    const plan = access?.plan ?? await this.prisma.saasPlan.findUnique({ where: { id: subscription.planId } });
    if (!plan) throw new ForbiddenException('Plano da assinatura indisponível');
    const [users, branches] = await Promise.all([
      this.prisma.companyUser.count({ where: { companyId, status: 'active' } }),
      this.prisma.branch.count({ where: { companyId, status: 'active', deletedAt: null } }),
    ]);
    return {
      id: subscription.id, status: subscription.status, trialEndsAt: subscription.trialEndsAt,
      currentPeriodStart: subscription.currentPeriodStart, currentPeriodEnd: subscription.currentPeriodEnd,
      blockedAt: subscription.blockedAt, plan: { code: plan.code, name: plan.name, price: plan.price.toString(), billingPeriod: plan.billingPeriod },
      usage: { users: { used: users, limit: plan.userLimit }, branches: { used: branches, limit: plan.branchLimit } },
      modules: access?.modules ?? [],
    };
  }

  async assertCapacity(database: Prisma.TransactionClient, companyId: string, capacity: Capacity): Promise<void> {
    await database.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`;
    const access = await this.getAccess(companyId, database);
    if (!access) throw new ForbiddenException('Assinatura inativa, vencida ou bloqueada');
    const used = capacity === 'users'
      ? await database.companyUser.count({ where: { companyId, status: 'active' } })
      : await database.branch.count({ where: { companyId, status: 'active', deletedAt: null } });
    const limit = capacity === 'users' ? access.plan.userLimit : access.plan.branchLimit;
    if (used >= limit) throw new ForbiddenException(`Limite de ${capacity === 'users' ? 'usuários' : 'filiais'} do plano atingido`);
  }
}
