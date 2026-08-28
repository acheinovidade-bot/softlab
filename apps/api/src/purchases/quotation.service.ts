import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  createQuotationSchema,
  quotationListSchema,
  quotationResponseSchema,
} from './quotation.schemas';

@Injectable()
export class QuotationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(auth: AccessTokenPayload, input: unknown) {
    const data = createQuotationSchema.parse(input);
    const now = new Date();
    if (data.responseDeadline <= now)
      throw new BadRequestException('O prazo de resposta deve estar no futuro');
    if (data.responseDeadline.getTime() > now.getTime() + 60 * 86_400_000)
      throw new BadRequestException('O prazo de resposta não pode exceder 60 dias');
    const suggestion = await this.prisma.purchaseSuggestion.findFirst({
      where: { id: data.suggestionId, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!suggestion) throw new NotFoundException('Sugestão de compra não encontrada');
    if (suggestion.status !== 'calculated')
      throw new ConflictException('A sugestão já foi convertida em cotação');
    const suggestedItems = await this.prisma.purchaseSuggestionItem.findMany({
      where: {
        companyId: auth.companyId,
        suggestionId: suggestion.id,
        suggestedQuantity: { gt: 0 },
      },
    });
    if (!suggestedItems.length)
      throw new ConflictException('A sugestão não possui itens para cotar');
    const productIds = suggestedItems.map(({ productId }) => productId);
    const catalogLinks = await this.prisma.supplierProduct.findMany({
      where: { companyId: auth.companyId, productId: { in: productIds } },
      select: { supplierId: true },
    });
    const supplierIds = [...new Set(catalogLinks.map(({ supplierId }) => supplierId))];
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        companyId: auth.companyId,
        id: { in: supplierIds },
        active: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!suppliers.length)
      throw new ConflictException(
        'Nenhum fornecedor ativo está relacionado aos produtos sugeridos',
      );
    const quotationId = uuidV7();
    const number = `COT-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${quotationId.slice(0, 6).toUpperCase()}`;
    const quotationItems = suggestedItems.map((item) => ({
      id: uuidV7(),
      companyId: auth.companyId,
      quotationId,
      productId: item.productId,
      quantity: item.suggestedQuantity,
      createdAt: now,
      updatedAt: now,
    }));
    const invitations = suppliers.map(({ id: supplierId }) => {
      const token = randomBytes(32).toString('base64url');
      return {
        id: uuidV7(),
        companyId: auth.companyId,
        quotationId,
        supplierId,
        accessTokenHash: this.hash(token),
        status: 'invited',
        createdAt: now,
        updatedAt: now,
        token,
      };
    });
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.quotation.create({
          data: {
            id: quotationId,
            companyId: auth.companyId,
            branchId: auth.branchId,
            purchaseSuggestionId: suggestion.id,
            number,
            status: 'open',
            responseDeadline: data.responseDeadline,
            createdAt: now,
            updatedAt: now,
          },
        });
        await tx.quotationItem.createMany({ data: quotationItems });
        await tx.quotationSupplier.createMany({
          data: invitations.map((invitation) => ({
            id: invitation.id,
            companyId: invitation.companyId,
            quotationId: invitation.quotationId,
            supplierId: invitation.supplierId,
            accessTokenHash: invitation.accessTokenHash,
            status: invitation.status,
            createdAt: invitation.createdAt,
            updatedAt: invitation.updatedAt,
          })),
        });
        await tx.purchaseSuggestion.update({
          where: { id: suggestion.id },
          data: { status: 'quoted', updatedAt: now },
        });
        await tx.auditLog.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            userId: auth.sub,
            action: 'purchase.quotation.create',
            entityType: 'quotation',
            entityId: quotationId,
            afterData: this.json({
              number,
              suggestionId: suggestion.id,
              itemCount: quotationItems.length,
              supplierCount: invitations.length,
              responseDeadline: data.responseDeadline,
            }),
            occurredAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('A sugestão já possui uma cotação');
      throw error;
    }
    return {
      ...(await this.get(auth, quotationId)),
      invitations: invitations.map(({ id, supplierId, token }) => ({
        quotationSupplierId: id,
        supplierId,
        publicPath: `/quotation/${token}`,
      })),
    };
  }

  async list(auth: AccessTokenPayload, query: unknown) {
    const page = quotationListSchema.parse(query);
    const where = { companyId: auth.companyId, branchId: auth.branchId };
    const [records, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.quotation.count({ where }),
    ]);
    const ids = records.map(({ id }) => id);
    const [items, suppliers] = ids.length
      ? await Promise.all([
          this.prisma.quotationItem.findMany({
            where: { companyId: auth.companyId, quotationId: { in: ids } },
            select: { quotationId: true },
          }),
          this.prisma.quotationSupplier.findMany({
            where: { companyId: auth.companyId, quotationId: { in: ids } },
            select: { quotationId: true, status: true },
          }),
        ])
      : [[], []];
    const now = new Date();
    return {
      items: records.map((record) => {
        const relatedSuppliers = suppliers.filter(({ quotationId }) => quotationId === record.id);
        return {
          ...record,
          status:
            record.status === 'open' && record.responseDeadline < now ? 'expired' : record.status,
          itemCount: items.filter(({ quotationId }) => quotationId === record.id).length,
          supplierCount: relatedSuppliers.length,
          responseCount: relatedSuppliers.filter(({ status }) => status === 'responded').length,
        };
      }),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async get(auth: AccessTokenPayload, id: string) {
    const quotation = await this.quotation(auth, id);
    const [items, quotationSuppliers] = await Promise.all([
      this.prisma.quotationItem.findMany({ where: { companyId: auth.companyId, quotationId: id } }),
      this.prisma.quotationSupplier.findMany({
        where: { companyId: auth.companyId, quotationId: id },
      }),
    ]);
    const productIds = items.map(({ productId }) => productId);
    const supplierIds = quotationSuppliers.map(({ supplierId }) => supplierId);
    const quotationSupplierIds = quotationSuppliers.map(({ id: supplierId }) => supplierId);
    const [products, suppliers, responses, catalogLinks] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, id: { in: productIds } },
        select: { id: true, code: true, description: true },
      }),
      this.prisma.supplier.findMany({
        where: { companyId: auth.companyId, id: { in: supplierIds } },
        select: { id: true, legalName: true, tradeName: true, phone: true },
      }),
      this.prisma.quotationResponseItem.findMany({
        where: { companyId: auth.companyId, quotationSupplierId: { in: quotationSupplierIds } },
      }),
      this.prisma.supplierProduct.findMany({
        where: {
          companyId: auth.companyId,
          supplierId: { in: supplierIds },
          productId: { in: productIds },
        },
        select: { supplierId: true, productId: true, lastPrice: true },
      }),
    ]);
    let totalSavings = new Prisma.Decimal(0);
    const comparisonItems = items.map((item) => {
      const itemResponses = responses.filter(({ quotationItemId }) => quotationItemId === item.id);
      const prices = itemResponses.map(({ unitPrice }) => unitPrice);
      const leads = itemResponses.flatMap(({ leadDays }) => (leadDays === null ? [] : [leadDays]));
      const terms = itemResponses.flatMap(({ paymentTermDays }) =>
        paymentTermDays === null ? [] : [paymentTermDays],
      );
      const lowest = prices.length ? Prisma.Decimal.min(...prices) : null;
      const highest = prices.length ? Prisma.Decimal.max(...prices) : null;
      const shortest = leads.length ? Math.min(...leads) : null;
      const bestTerm = terms.length ? Math.max(...terms) : null;
      const potentialSavings =
        lowest && highest ? highest.sub(lowest).mul(item.quantity) : new Prisma.Decimal(0);
      totalSavings = totalSavings.add(potentialSavings);
      return {
        ...item,
        product: products.find(({ id: productId }) => productId === item.productId) ?? {
          code: 'INATIVO',
          description: 'Produto indisponível',
        },
        lowestPrice: lowest,
        potentialSavings,
        offers: itemResponses.map((response) => {
          const invitation = quotationSuppliers.find(
            ({ id: supplierId }) => supplierId === response.quotationSupplierId,
          );
          const supplier = suppliers.find(
            ({ id: supplierId }) => supplierId === invitation?.supplierId,
          );
          if (!invitation || !supplier)
            throw new ConflictException('Resposta de cotação inconsistente');
          const lastPrice =
            catalogLinks.find(
              ({ supplierId, productId }) =>
                supplierId === invitation.supplierId && productId === item.productId,
            )?.lastPrice ?? null;
          return {
            ...response,
            quotationSupplierId: invitation.id,
            supplier,
            lastPrice,
            priceChange: lastPrice ? response.unitPrice.sub(lastPrice) : null,
            isLowestPrice: lowest?.eq(response.unitPrice) ?? false,
            isShortestLead: shortest !== null && response.leadDays === shortest,
            isBestPaymentTerm: bestTerm !== null && response.paymentTermDays === bestTerm,
          };
        }),
      };
    });
    const now = new Date();
    return {
      ...quotation,
      status:
        quotation.status === 'open' && quotation.responseDeadline < now
          ? 'expired'
          : quotation.status,
      itemCount: items.length,
      supplierCount: quotationSuppliers.length,
      responseCount: quotationSuppliers.filter(({ status }) => status === 'responded').length,
      totalPotentialSavings: totalSavings,
      items: comparisonItems,
      suppliers: quotationSuppliers.map((record) => ({
        ...record,
        supplier: suppliers.find(({ id: supplierId }) => supplierId === record.supplierId) ?? {
          legalName: 'Fornecedor indisponível',
          tradeName: null,
          phone: null,
        },
      })),
    };
  }

  async rotateLink(auth: AccessTokenPayload, quotationId: string, quotationSupplierId: string) {
    const quotation = await this.quotation(auth, quotationId);
    if (quotation.status !== 'open' || quotation.responseDeadline <= new Date())
      throw new ConflictException('Cotação encerrada ou expirada');
    const invitation = await this.prisma.quotationSupplier.findFirst({
      where: { id: quotationSupplierId, quotationId, companyId: auth.companyId },
    });
    if (!invitation) throw new NotFoundException('Fornecedor convidado não encontrado');
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.quotationSupplier.update({
        where: { id: invitation.id },
        data: {
          accessTokenHash: this.hash(token),
          status: invitation.status === 'responded' ? 'responded' : 'invited',
          sentAt: now,
          updatedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          userId: auth.sub,
          action: 'purchase.quotation.link.rotate',
          entityType: 'quotation_supplier',
          entityId: invitation.id,
          afterData: this.json({ quotationId, supplierId: invitation.supplierId }),
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    });
    return {
      quotationSupplierId: invitation.id,
      supplierId: invitation.supplierId,
      publicPath: `/quotation/${token}`,
    };
  }

  async publicView(token: string) {
    const context = await this.publicContext(token);
    const items = await this.prisma.quotationItem.findMany({
      where: { companyId: context.quotation.companyId, quotationId: context.quotation.id },
    });
    const productIds = items.map(({ productId }) => productId);
    const [products, responses, company, supplier] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: context.quotation.companyId, id: { in: productIds } },
        select: { id: true, code: true, description: true },
      }),
      this.prisma.quotationResponseItem.findMany({
        where: {
          companyId: context.quotation.companyId,
          quotationSupplierId: context.invitation.id,
        },
      }),
      this.prisma.company.findFirst({
        where: { id: context.quotation.companyId },
        select: { legalName: true, tradeName: true },
      }),
      this.prisma.supplier.findFirst({
        where: {
          id: context.invitation.supplierId,
          companyId: context.quotation.companyId,
        },
        select: { legalName: true, tradeName: true },
      }),
    ]);
    if (!company || !supplier) throw new NotFoundException('Convite de cotação não encontrado');
    const expired =
      context.quotation.status !== 'open' || context.quotation.responseDeadline <= new Date();
    return {
      number: context.quotation.number,
      companyName: company.tradeName ?? company.legalName,
      supplierName: supplier.tradeName ?? supplier.legalName,
      responseDeadline: context.quotation.responseDeadline,
      expired,
      submitted: responses.length > 0,
      items: items.map((item) => ({
        id: item.id,
        product: products.find(({ id: productId }) => productId === item.productId) ?? {
          code: 'INATIVO',
          description: 'Produto indisponível',
        },
        quantity: item.quantity,
        response: responses.find(({ quotationItemId }) => quotationItemId === item.id) ?? null,
      })),
    };
  }

  async respond(token: string, input: unknown) {
    const data = quotationResponseSchema.parse(input);
    const context = await this.publicContext(token);
    const now = new Date();
    if (context.quotation.status !== 'open' || context.quotation.responseDeadline <= now)
      throw new ConflictException('O prazo desta cotação foi encerrado');
    const items = await this.prisma.quotationItem.findMany({
      where: { companyId: context.quotation.companyId, quotationId: context.quotation.id },
    });
    const validIds = new Set(items.map(({ id }) => id));
    if (data.items.some(({ quotationItemId }) => !validIds.has(quotationItemId)))
      throw new BadRequestException('A resposta contém item que não pertence à cotação');
    await this.prisma.$transaction(async (tx) => {
      for (const item of data.items)
        await tx.quotationResponseItem.upsert({
          where: {
            quotationSupplierId_quotationItemId: {
              quotationSupplierId: context.invitation.id,
              quotationItemId: item.quotationItemId,
            },
          },
          update: {
            brand: item.brand,
            offeredQuantity: new Prisma.Decimal(item.offeredQuantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            leadDays: item.leadDays,
            paymentTerms: item.paymentTerms,
            paymentTermDays: item.paymentTermDays,
            notes: item.notes,
            updatedAt: now,
          },
          create: {
            id: uuidV7(),
            companyId: context.quotation.companyId,
            quotationSupplierId: context.invitation.id,
            quotationItemId: item.quotationItemId,
            brand: item.brand,
            offeredQuantity: new Prisma.Decimal(item.offeredQuantity),
            unitPrice: new Prisma.Decimal(item.unitPrice),
            leadDays: item.leadDays,
            paymentTerms: item.paymentTerms,
            paymentTermDays: item.paymentTermDays,
            notes: item.notes,
            createdAt: now,
            updatedAt: now,
          },
        });
      await tx.quotationSupplier.update({
        where: { id: context.invitation.id },
        data: { status: 'responded', respondedAt: now, updatedAt: now },
      });
      await tx.auditLog.create({
        data: {
          id: uuidV7(),
          companyId: context.quotation.companyId,
          branchId: context.quotation.branchId,
          action: 'purchase.quotation.supplier.respond',
          entityType: 'quotation_supplier',
          entityId: context.invitation.id,
          afterData: this.json({ quotationId: context.quotation.id, itemCount: data.items.length }),
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    });
    return this.publicView(token);
  }

  private async quotation(auth: AccessTokenPayload, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!quotation) throw new NotFoundException('Cotação não encontrada');
    return quotation;
  }

  private async publicContext(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new NotFoundException('Convite de cotação não encontrado');
    const invitation = await this.prisma.quotationSupplier.findFirst({
      where: { accessTokenHash: this.hash(token) },
    });
    if (!invitation) throw new NotFoundException('Convite de cotação não encontrado');
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: invitation.quotationId, companyId: invitation.companyId },
    });
    if (!quotation) throw new NotFoundException('Convite de cotação não encontrado');
    return { invitation, quotation };
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
