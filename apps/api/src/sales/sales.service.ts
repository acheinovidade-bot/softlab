import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  allocateOrderSchema,
  createSalesQuoteSchema,
  orderTransitionSchema,
  quoteTransitionSchema,
  salesListSchema,
} from './sales.schemas';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async lookups(auth: AccessTokenPayload) {
    const [customers, sellers, products, paymentMethods, warehouses] = await Promise.all([
      this.prisma.customer.findMany({
        where: { companyId: auth.companyId, active: true, deletedAt: null },
        orderBy: { legalName: 'asc' },
        take: 300,
        select: { id: true, legalName: true, tradeName: true },
      }),
      this.prisma.employee.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          OR: [{ branchId: auth.branchId }, { branchId: null }],
        },
        orderBy: { name: 'asc' },
        take: 200,
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, active: true, deletedAt: null },
        orderBy: { description: 'asc' },
        take: 500,
        select: {
          id: true,
          code: true,
          description: true,
          controlsLot: true,
          controlsExpiry: true,
          openPrice: true,
        },
      }),
      this.prisma.paymentMethod.findMany({
        where: { companyId: auth.companyId, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId },
        select: { id: true },
      }),
    ]);
    const now = new Date();
    const prices = await this.prisma.productPrice.findMany({
      where: {
        companyId: auth.companyId,
        productId: { in: products.map(({ id }) => id) },
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [{ OR: [{ branchId: auth.branchId }, { branchId: null }] }],
      },
      orderBy: [{ branchId: 'desc' }, { validFrom: 'desc' }],
    });
    const locations = await this.prisma.stockLocation.findMany({
      where: { companyId: auth.companyId, warehouseId: { in: warehouses.map(({ id }) => id) } },
      orderBy: { name: 'asc' },
    });
    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId, quantity: { gt: 0 } },
    });
    const lots = await this.prisma.stockLot.findMany({
      where: {
        companyId: auth.companyId,
        id: { in: balances.flatMap(({ lotId }) => (lotId ? [lotId] : [])) },
      },
      orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }],
    });
    return {
      customers: customers.map((item) => ({ id: item.id, name: item.tradeName ?? item.legalName })),
      sellers,
      paymentMethods,
      products: products.map((product) => ({
        ...product,
        price:
          prices.find(
            ({ productId, branchId }) => productId === product.id && branchId === auth.branchId,
          ) ??
          prices.find(({ productId, branchId }) => productId === product.id && !branchId) ??
          null,
      })),
      locations,
      lots: lots.map((lot) => ({
        ...lot,
        balances: balances
          .filter(({ lotId }) => lotId === lot.id)
          .map((balance) => ({
            locationId: balance.locationId,
            availableQuantity: balance.quantity.sub(balance.reservedQuantity),
          })),
      })),
    };
  }

  async createQuote(auth: AccessTokenPayload, input: unknown) {
    const data = createSalesQuoteSchema.parse(input);
    if (
      (data.discount > 0 || data.items.some(({ discount }) => discount > 0)) &&
      !auth.permissions.includes('sales.discounts.apply')
    )
      throw new ForbiddenException('Permissão para desconto não concedida');
    const [customer, seller, paymentMethod, products] = await Promise.all([
      data.customerId
        ? this.prisma.customer.findFirst({
            where: {
              id: data.customerId,
              companyId: auth.companyId,
              active: true,
              deletedAt: null,
            },
          })
        : Promise.resolve(true),
      this.prisma.employee.findFirst({
        where: {
          id: data.sellerId,
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          OR: [{ branchId: auth.branchId }, { branchId: null }],
        },
      }),
      this.prisma.paymentMethod.findFirst({
        where: { id: data.paymentMethodId, companyId: auth.companyId, active: true },
      }),
      this.prisma.product.findMany({
        where: {
          companyId: auth.companyId,
          id: { in: data.items.map(({ productId }) => productId) },
          active: true,
          deletedAt: null,
        },
      }),
    ]);
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (!seller) throw new NotFoundException('Vendedor não encontrado');
    if (!paymentMethod) throw new NotFoundException('Forma de pagamento não encontrada');
    if (products.length !== data.items.length)
      throw new NotFoundException('Produto do orçamento não encontrado');
    const now = new Date();
    const prices = await this.prisma.productPrice.findMany({
      where: {
        companyId: auth.companyId,
        productId: { in: data.items.map(({ productId }) => productId) },
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        AND: [{ OR: [{ branchId: auth.branchId }, { branchId: null }] }],
      },
      orderBy: [{ branchId: 'desc' }, { validFrom: 'desc' }],
    });
    const calculated = data.items.map((item) => {
      const product = products.find(({ id }) => id === item.productId);
      const price =
        prices.find(
          ({ productId, branchId }) => productId === item.productId && branchId === auth.branchId,
        ) ?? prices.find(({ productId, branchId }) => productId === item.productId && !branchId);
      if (!product || (!price && item.unitPrice === null))
        throw new ConflictException(
          `Produto ${product?.description ?? item.productId} sem preço vigente`,
        );
      if (item.unitPrice !== null && !product.openPrice && !price?.salePrice.eq(item.unitPrice))
        throw new ConflictException(`Preço manual não permitido para ${product.description}`);
      const unitPrice = new Prisma.Decimal(item.unitPrice ?? price?.salePrice ?? 0);
      const gross = unitPrice.mul(item.quantity);
      if (new Prisma.Decimal(item.discount).gt(gross))
        throw new BadRequestException(`Desconto maior que o item ${product.description}`);
      if (price?.minimumPrice && gross.sub(item.discount).div(item.quantity).lt(price.minimumPrice))
        throw new ConflictException(`Preço líquido abaixo do mínimo para ${product.description}`);
      return {
        product,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice,
        discount: new Prisma.Decimal(item.discount),
        total: gross.sub(item.discount),
        gross,
      };
    });
    const grossSubtotal = calculated.reduce(
      (sum, item) => sum.add(item.gross),
      new Prisma.Decimal(0),
    );
    const lineDiscount = calculated.reduce(
      (sum, item) => sum.add(item.discount),
      new Prisma.Decimal(0),
    );
    const discount = lineDiscount.add(data.discount);
    if (discount.gt(grossSubtotal)) throw new BadRequestException('Desconto maior que o subtotal');
    const total = grossSubtotal.sub(discount).add(data.surcharge).add(data.freight);
    const id = uuidV7();
    const number = `ORC-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
    await this.serializable(async (tx) => {
      await tx.salesQuote.create({
        data: {
          id,
          companyId: auth.companyId,
          branchId: auth.branchId,
          customerId: data.customerId,
          sellerId: data.sellerId,
          paymentMethodId: data.paymentMethodId,
          number,
          status: 'draft',
          validUntil: data.validUntil,
          subtotal: grossSubtotal,
          discount,
          surcharge: new Prisma.Decimal(data.surcharge),
          freight: new Prisma.Decimal(data.freight),
          total,
          notes: data.notes,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.salesQuoteItem.createMany({
        data: calculated.map((item) => ({
          id: uuidV7(),
          companyId: auth.companyId,
          salesQuoteId: id,
          productId: item.product.id,
          description: item.product.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
          createdAt: now,
          updatedAt: now,
        })),
      });
      await this.audit(tx, auth, 'sales.quote.create', 'sales_quote', id, null, {
        number,
        total,
        itemCount: calculated.length,
      });
    });
    return (await this.listQuotes(auth, {})).items.find((item) => item.id === id);
  }

  async listQuotes(auth: AccessTokenPayload, query: unknown) {
    const page = salesListSchema.parse(query);
    const where: Prisma.SalesQuoteWhereInput = {
      companyId: auth.companyId,
      branchId: auth.branchId,
      ...(page.status === 'all' ? {} : { status: page.status }),
    };
    const [records, total] = await Promise.all([
      this.prisma.salesQuote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.salesQuote.count({ where }),
    ]);
    return {
      items: await this.quoteSummaries(auth.companyId, records),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async transitionQuote(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = quoteTransitionSchema.parse(input);
    const quote = await this.quote(auth, id);
    const allowed: Record<string, string[]> = {
      draft: ['sent', 'canceled'],
      sent: ['approved', 'canceled'],
      approved: ['canceled'],
    };
    if (!allowed[quote.status]?.includes(data.toStatus))
      throw new ConflictException('Transição de orçamento inválida');
    if (quote.validUntil && quote.validUntil < this.today())
      throw new ConflictException('Orçamento vencido');
    const now = new Date();
    await this.serializable(async (tx) => {
      const changed = await tx.salesQuote.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: quote.status },
        data: { status: data.toStatus, updatedAt: now },
      });
      if (changed.count !== 1) throw new ConflictException('Orçamento alterado por outro usuário');
      await this.audit(
        tx,
        auth,
        'sales.quote.transition',
        'sales_quote',
        id,
        { status: quote.status },
        { status: data.toStatus },
      );
    });
    return (await this.listQuotes(auth, {})).items.find((item) => item.id === id);
  }

  async convertQuote(auth: AccessTokenPayload, id: string) {
    const quote = await this.quote(auth, id);
    if (quote.status !== 'approved')
      throw new ConflictException('Apenas orçamento aprovado pode virar pedido');
    if (quote.validUntil && quote.validUntil < this.today())
      throw new ConflictException('Orçamento vencido');
    const items = await this.prisma.salesQuoteItem.findMany({
      where: { companyId: auth.companyId, salesQuoteId: id },
    });
    if (!items.length) throw new ConflictException('Orçamento sem itens');
    const now = new Date();
    const orderId = uuidV7();
    const number = `PED-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${orderId.slice(0, 6).toUpperCase()}`;
    await this.serializable(async (tx) => {
      const changed = await tx.salesQuote.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: 'approved' },
        data: { status: 'converted', updatedAt: now },
      });
      if (changed.count !== 1) throw new ConflictException('Orçamento já convertido');
      await tx.order.create({
        data: {
          id: orderId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          customerId: quote.customerId,
          salesQuoteId: quote.id,
          sellerId: quote.sellerId,
          paymentMethodId: quote.paymentMethodId,
          number,
          origin: 'sales_quote',
          status: 'separation',
          subtotal: quote.subtotal,
          discount: quote.discount,
          surcharge: quote.surcharge,
          freight: quote.freight,
          total: quote.total,
          notes: quote.notes,
          createdAt: now,
          updatedAt: now,
        },
      });
      const products = await tx.product.findMany({
        where: { companyId: auth.companyId, id: { in: items.map(({ productId }) => productId) } },
        select: { id: true, description: true, controlsLot: true },
      });
      for (const item of items) {
        const product = products.find(({ id: productId }) => productId === item.productId);
        if (!product) throw new ConflictException('Produto do pedido não encontrado');
        const balances = await tx.stockBalance.findMany({
          where: {
            companyId: auth.companyId,
            branchId: auth.branchId,
            productId: item.productId,
            quantity: { gt: 0 },
            ...(product.controlsLot ? { lotId: { not: null } } : {}),
          },
        });
        const lots = product.controlsLot
          ? await tx.stockLot.findMany({
              where: {
                companyId: auth.companyId,
                id: { in: balances.flatMap(({ lotId }) => (lotId ? [lotId] : [])) },
              },
            })
          : [];
        balances.sort((left, right) => {
          const leftExpiry =
            lots.find(({ id: lotId }) => lotId === left.lotId)?.expiresAt?.getTime() ??
            Number.MAX_SAFE_INTEGER;
          const rightExpiry =
            lots.find(({ id: lotId }) => lotId === right.lotId)?.expiresAt?.getTime() ??
            Number.MAX_SAFE_INTEGER;
          return leftExpiry - rightExpiry;
        });
        let remaining = item.quantity;
        let remainingTotal = item.total;
        let remainingDiscount = item.discount;
        for (const balance of balances) {
          const available = balance.quantity.sub(balance.reservedQuantity);
          if (available.lte(0) || remaining.lte(0)) continue;
          const quantity = Prisma.Decimal.min(available, remaining);
          const isLast = quantity.equals(remaining);
          const ratio = quantity.div(item.quantity);
          const total = isLast ? remainingTotal : item.total.mul(ratio).toDecimalPlaces(4);
          const discount = isLast ? remainingDiscount : item.discount.mul(ratio).toDecimalPlaces(4);
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              reservedQuantity: { increment: quantity },
              version: { increment: 1 },
              updatedAt: now,
            },
          });
          await tx.orderItem.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              orderId,
              productId: item.productId,
              locationId: balance.locationId,
              lotId: balance.lotId,
              description: item.description,
              quantity,
              unitPrice: item.unitPrice,
              discount,
              total,
              createdAt: now,
              updatedAt: now,
            },
          });
          remaining = remaining.sub(quantity);
          remainingTotal = remainingTotal.sub(total);
          remainingDiscount = remainingDiscount.sub(discount);
        }
        if (remaining.gt(0))
          throw new ConflictException(
            `Estoque disponível insuficiente para ${product.description}`,
          );
      }
      if (quote.paymentMethodId)
        await tx.payment.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            orderId,
            paymentMethodId: quote.paymentMethodId,
            amount: quote.total,
            status: 'pending',
            idempotencyKey: `order:${orderId}:payment:1`,
            createdAt: now,
            updatedAt: now,
          },
        });
      await this.audit(tx, auth, 'sales.quote.convert', 'order', orderId, null, {
        salesQuoteId: quote.id,
        number,
        total: quote.total,
        stockReserved: true,
      });
    });
    return this.getOrder(auth, orderId);
  }

  async listOrders(auth: AccessTokenPayload, query: unknown) {
    const page = salesListSchema.parse(query);
    const where: Prisma.OrderWhereInput = {
      companyId: auth.companyId,
      branchId: auth.branchId,
      ...(page.status === 'all' ? {} : { status: page.status }),
    };
    const [records, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      items: await Promise.all(records.map((record) => this.orderSummary(auth.companyId, record))),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async getOrder(auth: AccessTokenPayload, id: string) {
    return this.orderSummary(auth.companyId, await this.order(auth, id));
  }

  async customerInsights(auth: AccessTokenPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId: auth.companyId, active: true, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const orders = await this.prisma.order.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId, customerId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const items = await this.prisma.orderItem.findMany({
      where: { companyId: auth.companyId, orderId: { in: orders.map(({ id }) => id) } },
      orderBy: { createdAt: 'desc' },
    });
    const [products, sales] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, id: { in: items.map(({ productId }) => productId) } },
        select: { id: true, code: true, description: true },
      }),
      this.prisma.sale.findMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          orderId: { in: orders.map(({ id }) => id) },
        },
        select: { id: true, orderId: true, number: true, status: true, soldAt: true, total: true },
        orderBy: { soldAt: 'desc' },
      }),
    ]);
    const grouped = new Map<
      string,
      { quantity: Prisma.Decimal; total: Prisma.Decimal; dates: Date[] }
    >();
    for (const item of items) {
      const current = grouped.get(item.productId) ?? {
        quantity: new Prisma.Decimal(0),
        total: new Prisma.Decimal(0),
        dates: [],
      };
      current.quantity = current.quantity.add(item.quantity);
      current.total = current.total.add(item.total);
      current.dates.push(item.createdAt);
      grouped.set(item.productId, current);
    }
    const now = Date.now();
    const recommendations = [...grouped.entries()]
      .map(([productId, value]) => {
        const orderedDates = value.dates.sort((a, b) => a.getTime() - b.getTime());
        const intervals = orderedDates
          .slice(1)
          .map((date, index) => (date.getTime() - orderedDates[index]!.getTime()) / 86_400_000);
        const averageIntervalDays = intervals.length
          ? Math.max(
              1,
              Math.round(intervals.reduce((sum, days) => sum + days, 0) / intervals.length),
            )
          : 30;
        const lastPurchasedAt = orderedDates.at(-1)!;
        const daysSincePurchase = Math.floor((now - lastPurchasedAt.getTime()) / 86_400_000);
        const product = products.find(({ id }) => id === productId);
        return {
          productId,
          code: product?.code ?? '',
          description: product?.description ?? 'Produto',
          suggestedQuantity: Math.max(
            1,
            Math.ceil(value.quantity.toNumber() / orderedDates.length),
          ),
          lastPurchasedAt,
          averageIntervalDays,
          daysSincePurchase,
          due: daysSincePurchase >= averageIntervalDays * 0.8,
        };
      })
      .sort((a, b) => Number(b.due) - Number(a.due) || b.daysSincePurchase - a.daysSincePurchase)
      .slice(0, 20);
    return {
      customer: {
        id: customer.id,
        name: customer.tradeName ?? customer.legalName,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        creditLimit: customer.creditLimit,
      },
      summary: {
        orderCount: orders.length,
        totalPurchased: orders.reduce((sum, order) => sum.add(order.total), new Prisma.Decimal(0)),
        lastOrderAt: orders[0]?.createdAt ?? null,
      },
      history: orders.slice(0, 30).map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        total: order.total,
        createdAt: order.createdAt,
        sale: sales.find(({ orderId }) => orderId === order.id) ?? null,
        items: items
          .filter(({ orderId }) => orderId === order.id)
          .map((item) => ({
            ...item,
            product: products.find(({ id }) => id === item.productId) ?? null,
          })),
      })),
      recommendations,
    };
  }

  async allocate(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = allocateOrderSchema.parse(input);
    await this.serializable(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, companyId: auth.companyId, branchId: auth.branchId },
      });
      if (!order) throw new NotFoundException('Pedido não encontrado');
      if (!['pending', 'separation'].includes(order.status))
        throw new ConflictException('Pedido não está disponível para separação');
      const items = await tx.orderItem.findMany({
        where: { companyId: auth.companyId, orderId: id },
      });
      if (
        data.items.length !== items.length ||
        data.items.some(
          ({ orderItemId }) => !items.some(({ id: itemId }) => itemId === orderItemId),
        )
      )
        throw new BadRequestException('Informe a separação de todos os itens');
      const products = await tx.product.findMany({
        where: { companyId: auth.companyId, id: { in: items.map(({ productId }) => productId) } },
      });
      for (const item of items)
        if (item.locationId) {
          const oldBalance = await tx.stockBalance.findFirst({
            where: {
              companyId: auth.companyId,
              branchId: auth.branchId,
              locationId: item.locationId,
              productId: item.productId,
              lotId: item.lotId,
            },
          });
          if (!oldBalance || oldBalance.reservedQuantity.lt(item.quantity))
            throw new ConflictException('Reserva anterior do pedido está inconsistente');
          await tx.stockBalance.update({
            where: { id: oldBalance.id },
            data: {
              reservedQuantity: { decrement: item.quantity },
              version: { increment: 1 },
              updatedAt: new Date(),
            },
          });
        }
      const now = new Date();
      for (const allocation of data.items) {
        const item = items.find(({ id: itemId }) => itemId === allocation.orderItemId);
        const product = products.find(({ id: productId }) => productId === item?.productId);
        if (!item || !product) throw new NotFoundException('Item de pedido não encontrado');
        const location = await tx.stockLocation.findFirst({
          where: { id: allocation.locationId, companyId: auth.companyId },
        });
        const warehouse = location
          ? await tx.warehouse.findFirst({
              where: {
                id: location.warehouseId,
                companyId: auth.companyId,
                branchId: auth.branchId,
              },
            })
          : null;
        if (!location || !warehouse) throw new NotFoundException('Localização fora da filial');
        if (product.controlsLot !== Boolean(allocation.lotId))
          throw new BadRequestException(
            product.controlsLot
              ? `Lote obrigatório para ${product.description}`
              : `Lote não permitido para ${product.description}`,
          );
        if (
          allocation.lotId &&
          !(await tx.stockLot.findFirst({
            where: { id: allocation.lotId, companyId: auth.companyId, productId: item.productId },
          }))
        )
          throw new NotFoundException(`Lote inválido para ${product.description}`);
        const balance = await tx.stockBalance.findFirst({
          where: {
            companyId: auth.companyId,
            branchId: auth.branchId,
            locationId: allocation.locationId,
            productId: item.productId,
            lotId: allocation.lotId,
          },
        });
        if (
          !product.allowsNegativeStock &&
          (!balance || balance.quantity.sub(balance.reservedQuantity).lt(item.quantity))
        )
          throw new ConflictException(`Estoque insuficiente para ${product.description}`);
        if (balance)
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              reservedQuantity: { increment: item.quantity },
              version: { increment: 1 },
              updatedAt: now,
            },
          });
        else
          await tx.stockBalance.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              branchId: auth.branchId,
              locationId: allocation.locationId,
              productId: item.productId,
              lotId: allocation.lotId,
              quantity: 0,
              reservedQuantity: item.quantity,
              version: 0,
              createdAt: now,
              updatedAt: now,
            },
          });
        await tx.orderItem.update({
          where: { id: item.id },
          data: { locationId: allocation.locationId, lotId: allocation.lotId, updatedAt: now },
        });
      }
      await this.audit(tx, auth, 'sales.order.allocate', 'order', id, null, {
        itemCount: data.items.length,
      });
    });
    return this.getOrder(auth, id);
  }

  async transitionOrder(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = orderTransitionSchema.parse(input);
    const order = await this.order(auth, id);
    const allowed: Record<string, string[]> = {
      pending: ['separation', 'canceled'],
      separation: ['invoicing', 'canceled'],
      invoicing: ['delivery'],
      delivery: ['completed'],
    };
    if (!allowed[order.status]?.includes(data.toStatus))
      throw new ConflictException('Transição de pedido inválida');
    if (order.status === 'separation' && data.toStatus === 'invoicing') {
      await this.invoice(auth, id);
      return this.getOrder(auth, id);
    }
    if (data.toStatus === 'canceled') {
      await this.cancelOrder(auth, id, order.status);
      return this.getOrder(auth, id);
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.order.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: order.status },
        data: { status: data.toStatus, updatedAt: now },
      });
      if (changed.count !== 1) throw new ConflictException('Pedido alterado por outro usuário');
      if (data.toStatus === 'completed')
        await tx.sale.updateMany({
          where: { companyId: auth.companyId, branchId: auth.branchId, orderId: id },
          data: { status: 'completed', updatedAt: now },
        });
      await this.audit(
        tx,
        auth,
        'sales.order.transition',
        'order',
        id,
        { status: order.status },
        { status: data.toStatus },
      );
    });
    return this.getOrder(auth, id);
  }

  private async invoice(auth: AccessTokenPayload, id: string) {
    await this.serializable(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: 'separation' },
      });
      if (!order) throw new ConflictException('Pedido não está disponível para faturamento');
      const items = await tx.orderItem.findMany({
        where: { companyId: auth.companyId, orderId: id },
      });
      if (!items.length || items.some(({ locationId }) => !locationId))
        throw new ConflictException('Conclua a separação de todos os itens');
      const products = await tx.product.findMany({
        where: { companyId: auth.companyId, id: { in: items.map(({ productId }) => productId) } },
        select: { id: true, description: true, allowsNegativeStock: true, taxProfile: true },
      });
      const now = new Date();
      const saleId = uuidV7();
      const saleNumber = `VEN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${saleId.slice(0, 6).toUpperCase()}`;
      await tx.sale.create({
        data: {
          id: saleId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          orderId: order.id,
          number: saleNumber,
          status: 'invoiced',
          soldAt: now,
          total: order.total,
          createdAt: now,
          updatedAt: now,
        },
      });
      for (const item of items) {
        const product = products.find(({ id: productId }) => productId === item.productId);
        if (!product || !item.locationId)
          throw new ConflictException('Produto separado não está disponível');
        const balance = await tx.stockBalance.findFirst({
          where: {
            companyId: auth.companyId,
            branchId: auth.branchId,
            locationId: item.locationId,
            productId: item.productId,
            lotId: item.lotId,
          },
        });
        if (!balance || balance.reservedQuantity.lt(item.quantity))
          throw new ConflictException(`Reserva insuficiente para ${product.description}`);
        if (!product.allowsNegativeStock && balance.quantity.lt(item.quantity))
          throw new ConflictException(`Saldo insuficiente para ${product.description}`);
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: {
            quantity: { decrement: item.quantity },
            reservedQuantity: { decrement: item.quantity },
            version: { increment: 1 },
            updatedAt: now,
          },
        });
        const movement = await tx.stockMovement.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            locationId: item.locationId,
            productId: item.productId,
            lotId: item.lotId,
            movementType: 'sale',
            quantity: item.quantity.negated(),
            unitCost: null,
            referenceType: 'sale',
            referenceId: saleId,
            occurredAt: now,
            createdBy: auth.sub,
            createdAt: now,
            updatedAt: now,
          },
        });
        const saleItem = await tx.saleItem.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            saleId,
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
            taxSnapshot: product.taxProfile === null ? Prisma.JsonNull : product.taxProfile,
            createdAt: now,
            updatedAt: now,
          },
        });
        if (item.lotId)
          await tx.saleItemTrace.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              saleItemId: saleItem.id,
              lotId: item.lotId,
              stockMovementId: movement.id,
              quantity: item.quantity,
              createdAt: now,
              updatedAt: now,
            },
          });
      }
      const changed = await tx.order.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: 'separation' },
        data: { status: 'invoicing', updatedAt: now },
      });
      if (changed.count !== 1) throw new ConflictException('Pedido alterado por outro usuário');
      await this.audit(tx, auth, 'sales.order.invoice', 'sale', saleId, null, {
        orderId: id,
        number: saleNumber,
        total: order.total,
      });
    });
  }

  private async cancelOrder(auth: AccessTokenPayload, id: string, expectedStatus: string) {
    await this.serializable(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: expectedStatus },
      });
      if (!order) throw new ConflictException('Pedido alterado por outro usuário');
      const items = await tx.orderItem.findMany({
        where: { companyId: auth.companyId, orderId: id },
      });
      const now = new Date();
      for (const item of items)
        if (item.locationId) {
          const balance = await tx.stockBalance.findFirst({
            where: {
              companyId: auth.companyId,
              branchId: auth.branchId,
              locationId: item.locationId,
              productId: item.productId,
              lotId: item.lotId,
            },
          });
          if (!balance || balance.reservedQuantity.lt(item.quantity))
            throw new ConflictException('Reserva do pedido está inconsistente');
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              reservedQuantity: { decrement: item.quantity },
              version: { increment: 1 },
              updatedAt: now,
            },
          });
        }
      await tx.order.update({ where: { id }, data: { status: 'canceled', updatedAt: now } });
      await tx.payment.updateMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          orderId: id,
          status: 'pending',
        },
        data: { status: 'canceled', updatedAt: now },
      });
      await this.audit(
        tx,
        auth,
        'sales.order.cancel',
        'order',
        id,
        { status: expectedStatus },
        { status: 'canceled' },
      );
    });
  }

  private async serializable<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < 3) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        attempt += 1;
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
          attempt >= 3
        )
          throw error;
      }
    }
    throw new ConflictException('Conflito concorrente no estoque');
  }

  private async quoteSummaries(
    companyId: string,
    records: Array<{
      id: string;
      customerId: string | null;
      sellerId: string | null;
      paymentMethodId: string | null;
      validUntil: Date | null;
      status: string;
      [key: string]: unknown;
    }>,
  ) {
    const [customers, sellers, methods, items] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          companyId,
          id: { in: records.flatMap(({ customerId }) => (customerId ? [customerId] : [])) },
        },
        select: { id: true, legalName: true, tradeName: true },
      }),
      this.prisma.employee.findMany({
        where: {
          companyId,
          id: { in: records.flatMap(({ sellerId }) => (sellerId ? [sellerId] : [])) },
        },
        select: { id: true, name: true },
      }),
      this.prisma.paymentMethod.findMany({
        where: {
          companyId,
          id: {
            in: records.flatMap(({ paymentMethodId }) =>
              paymentMethodId ? [paymentMethodId] : [],
            ),
          },
        },
        select: { id: true, name: true },
      }),
      this.prisma.salesQuoteItem.findMany({
        where: { companyId, salesQuoteId: { in: records.map(({ id }) => id) } },
        select: { salesQuoteId: true },
      }),
    ]);
    return records.map((record) => ({
      ...record,
      status:
        record.validUntil instanceof Date &&
        record.validUntil < this.today() &&
        ['draft', 'sent', 'approved'].includes(record.status)
          ? 'expired'
          : record.status,
      customer: record.customerId ? this.customerLabel(customers, record.customerId) : null,
      seller: sellers.find(({ id }) => id === record.sellerId) ?? {
        id: '',
        name: 'Vendedor indisponível',
      },
      paymentMethod: methods.find(({ id }) => id === record.paymentMethodId) ?? {
        id: '',
        name: 'Não definida',
      },
      itemCount: items.filter(({ salesQuoteId }) => salesQuoteId === record.id).length,
    }));
  }
  private async orderSummary(companyId: string, order: Awaited<ReturnType<SalesService['order']>>) {
    const items = await this.prisma.orderItem.findMany({ where: { companyId, orderId: order.id } });
    const [customers, sellers, methods, products] = await Promise.all([
      this.prisma.customer.findMany({
        where: { companyId, id: { in: order.customerId ? [order.customerId] : [] } },
        select: { id: true, legalName: true, tradeName: true },
      }),
      this.prisma.employee.findMany({
        where: { companyId, id: { in: order.sellerId ? [order.sellerId] : [] } },
        select: { id: true, name: true },
      }),
      this.prisma.paymentMethod.findMany({
        where: { companyId, id: { in: order.paymentMethodId ? [order.paymentMethodId] : [] } },
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, id: { in: items.map(({ productId }) => productId) } },
        select: { id: true, controlsLot: true },
      }),
    ]);
    return {
      ...order,
      customer: order.customerId ? this.customerLabel(customers, order.customerId) : null,
      seller: sellers[0] ?? { id: '', name: 'Vendedor indisponível' },
      paymentMethod: methods[0] ?? { id: '', name: 'Não definida' },
      items: items.map((item) => ({
        ...item,
        controlsLot: products.find(({ id }) => id === item.productId)?.controlsLot ?? false,
      })),
    };
  }
  private async quote(auth: AccessTokenPayload, id: string) {
    const value = await this.prisma.salesQuote.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!value) throw new NotFoundException('Orçamento não encontrado');
    return value;
  }
  private async order(auth: AccessTokenPayload, id: string) {
    const value = await this.prisma.order.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!value) throw new NotFoundException('Pedido não encontrado');
    return value;
  }
  private customerLabel(
    customers: Array<{ id: string; legalName: string; tradeName: string | null }>,
    id: string,
  ) {
    const value = customers.find((item) => item.id === id);
    return value
      ? { id: value.id, name: value.tradeName ?? value.legalName }
      : { id: '', name: 'Cliente indisponível' };
  }
  private today() {
    const value = new Date();
    value.setUTCHours(0, 0, 0, 0);
    return value;
  }
  private audit(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    action: string,
    entityType: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
  ) {
    const now = new Date();
    return tx.auditLog.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        userId: auth.sub,
        action,
        entityType,
        entityId,
        ...(beforeData === null ? {} : { beforeData: this.json(beforeData) }),
        ...(afterData === null ? {} : { afterData: this.json(afterData) }),
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
