import { ForbiddenException } from '@nestjs/common';
import { SaasService } from './saas.service';

function database() {
  return {
    subscription: { findFirst: jest.fn() }, saasPlan: { findUnique: jest.fn() },
    planModule: { findMany: jest.fn() }, subscriptionModule: { findMany: jest.fn() },
    saasModule: { findMany: jest.fn() }, companyUser: { count: jest.fn() }, branch: { count: jest.fn() },
    $executeRaw: jest.fn(),
  };
}

describe('SaasService', () => {
  it('combines plan modules with subscription overrides', async () => {
    const prisma = database();
    prisma.subscription.findFirst.mockResolvedValue({ id: 's1', planId: 'p1', status: 'active', blockedAt: null, currentPeriodEnd: new Date(Date.now() + 60_000), trialEndsAt: null });
    prisma.saasPlan.findUnique.mockResolvedValue({ id: 'p1', active: true, userLimit: 5, branchLimit: 2 });
    prisma.planModule.findMany.mockResolvedValue([{ moduleId: 'core' }, { moduleId: 'stock' }]);
    prisma.subscriptionModule.findMany.mockResolvedValue([{ moduleId: 'stock', enabled: false }, { moduleId: 'finance', enabled: true }]);
    prisma.saasModule.findMany.mockResolvedValue([{ code: 'core' }, { code: 'finance' }]);
    const access = await new SaasService(prisma as never).getAccess('company');
    expect(access?.modules).toEqual([{ code: 'core' }, { code: 'finance' }]);
    expect(prisma.saasModule.findMany).toHaveBeenCalledWith({ where: { id: { in: ['core', 'finance'] }, active: true }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
  });

  it('blocks an expired trial', async () => {
    const prisma = database();
    prisma.subscription.findFirst.mockResolvedValue({ status: 'trial', blockedAt: null, currentPeriodEnd: new Date(Date.now() + 60_000), trialEndsAt: new Date(0) });
    await expect(new SaasService(prisma as never).getAccess('company')).resolves.toBeNull();
  });

  it('enforces plan capacity while holding a tenant advisory lock', async () => {
    const prisma = database();
    prisma.subscription.findFirst.mockResolvedValue({ id: 's1', planId: 'p1', status: 'active', blockedAt: null, currentPeriodEnd: new Date(Date.now() + 60_000), trialEndsAt: null });
    prisma.saasPlan.findUnique.mockResolvedValue({ id: 'p1', active: true, userLimit: 1, branchLimit: 2 });
    prisma.planModule.findMany.mockResolvedValue([]); prisma.subscriptionModule.findMany.mockResolvedValue([]); prisma.saasModule.findMany.mockResolvedValue([]);
    prisma.companyUser.count.mockResolvedValue(1);
    await expect(new SaasService(prisma as never).assertCapacity(prisma as never, 'company', 'users')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
