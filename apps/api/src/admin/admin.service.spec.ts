import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import type { AccessTokenPayload } from '../auth/auth.types';

const auth: AccessTokenPayload = {
  sub: '018f4f12-2222-7222-8222-333333333333',
  companyId: '018f4f12-2222-7222-8222-111111111111',
  branchId: '018f4f12-2222-7222-8222-222222222222',
  sessionId: '018f4f12-2222-7222-8222-444444444444',
  permissions: [],
  modules: ['core'],
};

const saas = { getSummary: jest.fn(), assertCapacity: jest.fn() };

function prismaMock() {
  return {
    branch: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    role: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
    companyUser: { findMany: jest.fn(), findFirst: jest.fn() },
  };
}

describe('AdminService tenant isolation', () => {
  it('always scopes branch listings to the token company', async () => {
    const prisma = prismaMock();
    prisma.branch.findMany.mockResolvedValue([]);
    const service = new AdminService(prisma as never, saas as never);
    await service.listBranches(auth);
    expect(prisma.branch.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, deletedAt: null }, orderBy: { code: 'asc' } });
  });

  it('does not update a branch outside the current company', async () => {
    const prisma = prismaMock();
    prisma.branch.findFirst.mockResolvedValue(null);
    const service = new AdminService(prisma as never, saas as never);
    await expect(service.updateBranch(auth, '018f4f12-2222-7222-8222-999999999999', { status: 'inactive' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not find a membership from another company', async () => {
    const prisma = prismaMock();
    prisma.companyUser.findFirst.mockResolvedValue(null);
    const service = new AdminService(prisma as never, saas as never);
    await expect(service.updateMembership(auth, '018f4f12-2222-7222-8222-999999999999', { status: 'inactive' })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.companyUser.findFirst).toHaveBeenCalledWith({ where: { id: '018f4f12-2222-7222-8222-999999999999', companyId: auth.companyId } });
  });
});
