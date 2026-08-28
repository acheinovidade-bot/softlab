import { NotFoundException } from '@nestjs/common';
import type { AccessTokenPayload } from '../auth/auth.types';
import { MasterDataService } from './master-data.service';

const auth: AccessTokenPayload = { sub: '018f4f12-2222-7222-8222-333333333333', companyId: '018f4f12-2222-7222-8222-111111111111', branchId: '018f4f12-2222-7222-8222-222222222222', sessionId: '018f4f12-2222-7222-8222-444444444444', permissions: [], modules: ['core', 'sales'] };
function database() { return { customer: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() }, branch: { findFirst: jest.fn() }, companyUser: { findFirst: jest.fn() } }; }

describe('MasterDataService tenant isolation', () => {
  it('scopes customer search and pagination to the token company', async () => {
    const prisma = database(); prisma.customer.findMany.mockResolvedValue([]); prisma.customer.count.mockResolvedValue(0);
    await new MasterDataService(prisma as never).listCustomers(auth, { search: 'Ana', page: '2', pageSize: '10' });
    expect(prisma.customer.findMany).toHaveBeenCalledWith({ where: { companyId: auth.companyId, deletedAt: null, active: true, OR: [{ legalName: { contains: 'Ana', mode: 'insensitive' } }, { tradeName: { contains: 'Ana', mode: 'insensitive' } }, { taxId: { contains: 'Ana' } }] }, orderBy: { legalName: 'asc' }, skip: 10, take: 10 });
  });

  it('does not update a customer belonging to another company', async () => {
    const prisma = database(); prisma.customer.findFirst.mockResolvedValue(null);
    await expect(new MasterDataService(prisma as never).updateCustomer(auth, '018f4f12-2222-7222-8222-999999999999', { active: false })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an employee branch outside the company', async () => {
    const prisma = database(); prisma.branch.findFirst.mockResolvedValue(null);
    await expect(new MasterDataService(prisma as never).createEmployee(auth, { code: '1', name: 'Pessoa Teste', branchId: '018f4f12-2222-7222-8222-999999999999' })).rejects.toThrow('Filial não encontrada na empresa');
  });
});
