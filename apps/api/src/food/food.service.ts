import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { PosService } from '../sales/pos.service';
import {
  addTabItemSchema,
  checkoutFoodSchema,
  createTableSchema,
  openTabSchema,
} from './food.schemas';
@Injectable()
export class FoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
  ) {}
  async overview(auth: AccessTokenPayload) {
    const now = new Date();
    const [tables, tabs, waiters, customers, products, posLookups] = await Promise.all([
      this.prisma.foodTable.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.foodTab.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, status: 'open' },
        orderBy: { openedAt: 'asc' },
      }),
      this.prisma.employee.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          OR: [{ branchId: auth.branchId }, { branchId: null }],
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: { companyId: auth.companyId, active: true, deletedAt: null },
        select: { id: true, legalName: true, tradeName: true },
        take: 300,
      }),
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, active: true, deletedAt: null },
        select: { id: true, code: true, description: true },
        take: 1000,
        orderBy: { description: 'asc' },
      }),
      this.pos.lookups(auth),
    ]);
    const [items, prices] = await Promise.all([
      this.prisma.foodTabItem.findMany({
        where: {
          companyId: auth.companyId,
          tabId: { in: tabs.map(({ id }) => id) },
          status: { not: 'canceled' },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.productPrice.findMany({
        where: {
          companyId: auth.companyId,
          productId: { in: products.map(({ id }) => id) },
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          AND: [{ OR: [{ branchId: auth.branchId }, { branchId: null }] }],
        },
        orderBy: { validFrom: 'desc' },
      }),
    ]);
    return {
      tables,
      waiters,
      customers: customers.map((c) => ({ id: c.id, name: c.tradeName ?? c.legalName })),
      products: products.flatMap((product) => {
        const price =
          prices.find((p) => p.productId === product.id && p.branchId === auth.branchId) ??
          prices.find((p) => p.productId === product.id && p.branchId === null);
        return price ? [{ ...product, price: price.salePrice }] : [];
      }),
      paymentMethods: posLookups.paymentMethods,
      locations: posLookups.locations,
      tabs: tabs.map((tab) => {
        const rows = items.filter(({ tabId }) => tabId === tab.id);
        return {
          ...tab,
          itemCount: rows.length,
          total: rows.reduce((sum, row) => sum.add(row.total), new Prisma.Decimal(0)),
        };
      }),
    };
  }
  async createTable(auth: AccessTokenPayload, input: unknown) {
    const data = createTableSchema.parse(input);
    const now = new Date();
    return this.prisma.foodTable.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        ...data,
        status: 'free',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  async openTab(auth: AccessTokenPayload, input: unknown) {
    const data = openTabSchema.parse(input);
    const now = new Date();
    if (data.tableId) {
      const table = await this.prisma.foodTable.findFirst({
        where: {
          id: data.tableId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          active: true,
        },
      });
      if (!table) throw new NotFoundException('Mesa não encontrada');
    }
    const number = `CMD-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${uuidV7().slice(0, 6).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const tab = await tx.foodTab.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          ...data,
          number,
          status: 'open',
          openedAt: now,
          closedAt: null,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (data.tableId)
        await tx.foodTable.update({
          where: { id: data.tableId },
          data: { status: 'occupied', updatedAt: now },
        });
      return tab;
    });
  }
  async addItem(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = addTabItemSchema.parse(input);
    const tab = await this.tab(auth, id);
    const [product, prices] = await Promise.all([
      this.prisma.product.findFirst({
        where: { id: data.productId, companyId: auth.companyId, active: true, deletedAt: null },
      }),
      this.prisma.productPrice.findMany({
        where: {
          companyId: auth.companyId,
          productId: data.productId,
          validFrom: { lte: new Date() },
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        },
        orderBy: { validFrom: 'desc' },
      }),
    ]);
    if (!product) throw new NotFoundException('Produto não encontrado');
    const price =
      prices.find((p) => p.branchId === auth.branchId) ?? prices.find((p) => p.branchId === null);
    if (!price) throw new ConflictException('Produto sem preço vigente');
    const quantity = new Prisma.Decimal(data.quantity);
    const now = new Date();
    return this.prisma.foodTabItem.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        tabId: tab.id,
        productId: product.id,
        quantity,
        unitPrice: price.salePrice,
        total: price.salePrice.mul(quantity),
        notes: data.notes,
        status: 'ordered',
        createdBy: auth.sub,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  async summary(auth: AccessTokenPayload, id: string) {
    const tab = await this.tab(auth, id);
    const rows = await this.prisma.foodTabItem.findMany({
      where: { companyId: auth.companyId, tabId: id, status: { not: 'canceled' } },
      orderBy: { createdAt: 'asc' },
    });
    const products = await this.prisma.product.findMany({
      where: { companyId: auth.companyId, id: { in: rows.map(({ productId }) => productId) } },
      select: { id: true, description: true },
    });
    return {
      tab,
      items: rows.map((row) => ({
        ...row,
        description:
          products.find(({ id: productId }) => productId === row.productId)?.description ??
          'Produto',
      })),
      total: rows.reduce((sum, row) => sum.add(row.total), new Prisma.Decimal(0)),
    };
  }
  async close(auth: AccessTokenPayload, id: string) {
    const tab = await this.tab(auth, id);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const closed = await tx.foodTab.update({
        where: { id },
        data: { status: 'closed', closedAt: now, updatedAt: now },
      });
      if (tab.tableId) {
        const remaining = await tx.foodTab.count({
          where: { companyId: auth.companyId, tableId: tab.tableId, status: 'open' },
        });
        if (remaining === 0)
          await tx.foodTable.update({
            where: { id: tab.tableId },
            data: { status: 'free', updatedAt: now },
          });
      }
      return closed;
    });
  }
  async checkout(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = checkoutFoodSchema.parse(input);
    const tab = await this.tab(auth, id);
    const rows = await this.prisma.foodTabItem.findMany({
      where: { companyId: auth.companyId, tabId: id, status: { not: 'canceled' } },
    });
    if (!rows.length) throw new ConflictException('Comanda sem itens para pagamento');
    const grouped = new Map<string, { quantity: Prisma.Decimal; total: Prisma.Decimal }>();
    for (const row of rows) {
      const current = grouped.get(row.productId) ?? {
        quantity: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
      };
      grouped.set(row.productId, {
        quantity: current.quantity.add(row.quantity),
        total: current.total.add(row.total),
      });
    }
    const result = await this.pos.checkout(
      auth,
      {
        ...data,
        customerId: tab.customerId,
        notes: `Comanda ${tab.number}`,
        creditDueDate: null,
        items: [...grouped.entries()].map(([productId, value]) => ({
          productId,
          quantity: value.quantity.toNumber(),
          unitPrice: null,
          discount: 0,
        })),
      },
      'food',
    );
    await this.close(auth, id);
    return result;
  }
  private async tab(auth: AccessTokenPayload, id: string) {
    const tab = await this.prisma.foodTab.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId, status: 'open' },
    });
    if (!tab) throw new NotFoundException('Comanda aberta não encontrada');
    return tab;
  }
}
