import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { QuotationService } from './quotation.service';

const auth: AccessTokenPayload = {
  sub: '018f4f12-2222-7222-8222-333333333333',
  companyId: '018f4f12-2222-7222-8222-111111111111',
  branchId: '018f4f12-2222-7222-8222-222222222222',
  sessionId: '018f4f12-2222-7222-8222-444444444444',
  permissions: [],
  modules: ['purchases'],
};
const suggestionId = '018f4f12-2222-7222-8222-555555555555';
const productId = '018f4f12-2222-7222-8222-666666666666';
const supplierId = '018f4f12-2222-7222-8222-777777777777';

describe('QuotationService', () => {
  it('creates a quotation from suggested items and persists only token hashes', async () => {
    let invitationRows: Array<{ accessTokenHash: string }> = [];
    let updatedStatus = '';
    const tx = {
      quotation: { create: jest.fn() },
      quotationItem: { createMany: jest.fn() },
      quotationSupplier: {
        createMany: jest.fn(({ data }: { data: Array<{ accessTokenHash: string }> }) => {
          invitationRows = data;
        }),
      },
      purchaseSuggestion: {
        update: jest.fn(({ data }: { data: { status: string } }) => {
          updatedStatus = data.status;
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      purchaseSuggestion: {
        findFirst: jest.fn().mockResolvedValue({ id: suggestionId, status: 'calculated' }),
      },
      purchaseSuggestionItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ productId, suggestedQuantity: new Prisma.Decimal(12) }]),
      },
      supplierProduct: { findMany: jest.fn().mockResolvedValue([{ supplierId }]) },
      supplier: { findMany: jest.fn().mockResolvedValue([{ id: supplierId }]) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new QuotationService(prisma as never);
    jest.spyOn(service, 'get').mockResolvedValue({ id: 'quotation' } as never);
    const result = await service.create(auth, {
      suggestionId,
      responseDeadline: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(invitationRows[0]?.accessTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.invitations[0]?.publicPath).toMatch(/^\/quotation\/[A-Za-z0-9_-]{43}$/);
    expect(invitationRows[0]?.accessTokenHash).not.toContain(
      result.invitations[0]!.publicPath.slice(-43),
    );
    expect(updatedStatus).toBe('quoted');
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('builds a comparison highlighting price, delivery, payment and savings', async () => {
    const itemId = 'item';
    const invitationOne = { id: 'invite-1', supplierId: 'supplier-1', status: 'responded' };
    const invitationTwo = { id: 'invite-2', supplierId: 'supplier-2', status: 'responded' };
    const prisma = {
      quotation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'quote',
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: 'open',
          responseDeadline: new Date(Date.now() + 86_400_000),
        }),
      },
      quotationItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: itemId, productId, quantity: new Prisma.Decimal(5) }]),
      },
      quotationSupplier: { findMany: jest.fn().mockResolvedValue([invitationOne, invitationTwo]) },
      product: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: productId, code: 'P1', description: 'Produto' }]),
      },
      supplier: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'supplier-1', legalName: 'Fornecedor 1', tradeName: null, phone: null },
          { id: 'supplier-2', legalName: 'Fornecedor 2', tradeName: null, phone: null },
        ]),
      },
      quotationResponseItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            quotationSupplierId: 'invite-1',
            quotationItemId: itemId,
            unitPrice: new Prisma.Decimal(10),
            offeredQuantity: new Prisma.Decimal(5),
            leadDays: 5,
            paymentTermDays: 30,
          },
          {
            quotationSupplierId: 'invite-2',
            quotationItemId: itemId,
            unitPrice: new Prisma.Decimal(12),
            offeredQuantity: new Prisma.Decimal(5),
            leadDays: 3,
            paymentTermDays: 60,
          },
        ]),
      },
      supplierProduct: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { supplierId: 'supplier-1', productId, lastPrice: new Prisma.Decimal(11) },
          ]),
      },
    };
    const result = await new QuotationService(prisma as never).get(auth, 'quote');
    const offers = result.items[0]!.offers;
    expect(offers[0]).toMatchObject({
      isLowestPrice: true,
      isShortestLead: false,
      isBestPaymentTerm: false,
    });
    expect(offers[1]).toMatchObject({
      isLowestPrice: false,
      isShortestLead: true,
      isBestPaymentTerm: true,
    });
    expect(result.totalPotentialSavings.toString()).toBe('10');
    expect(offers[0]!.priceChange?.toString()).toBe('-1');
  });

  it('rejects expired responses and items from another quotation', async () => {
    const token = 'a'.repeat(43);
    const invitation = { id: 'invite', quotationId: 'quote', companyId: auth.companyId };
    const expiredPrisma = {
      quotationSupplier: { findFirst: jest.fn().mockResolvedValue(invitation) },
      quotation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'quote',
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: 'open',
          responseDeadline: new Date(Date.now() - 1000),
        }),
      },
    };
    const body = { items: [{ quotationItemId: suggestionId, offeredQuantity: 1, unitPrice: 10 }] };
    await expect(
      new QuotationService(expiredPrisma as never).respond(token, body),
    ).rejects.toBeInstanceOf(ConflictException);
    const currentPrisma = {
      quotationSupplier: { findFirst: jest.fn().mockResolvedValue(invitation) },
      quotation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'quote',
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: 'open',
          responseDeadline: new Date(Date.now() + 86_400_000),
        }),
      },
      quotationItem: { findMany: jest.fn().mockResolvedValue([{ id: productId }]) },
    };
    await expect(
      new QuotationService(currentPrisma as never).respond(token, body),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
