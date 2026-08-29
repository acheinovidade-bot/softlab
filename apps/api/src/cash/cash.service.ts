import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  cardOperatorSchema,
  cashPeriodQuerySchema,
  cashMovementSchema,
  closeCashSchema,
  createCashRegisterSchema,
  openCashSchema,
  paymentMethodSchema,
  updateCardOperatorSchema,
  updatePaymentMethodSchema,
} from './cash.schemas';

@Injectable()
export class CashService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(auth: AccessTokenPayload) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    const dayStart = new Date(today);
    dayStart.setUTCDate(dayStart.getUTCDate() - 13);
    const [sales, pendingOrders, receivables, branchSettings, balances] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          soldAt: { gte: yearStart },
          status: 'completed',
        },
        select: { id: true, total: true, soldAt: true },
        orderBy: { soldAt: 'asc' },
        take: 20_000,
      }),
      this.prisma.order.count({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: { in: ['pending', 'separation', 'invoicing', 'delivery'] },
        },
      }),
      this.prisma.accountReceivable.aggregate({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: { in: ['open', 'partial'] },
        },
        _sum: { openAmount: true },
      }),
      this.prisma.productBranchSetting.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
        select: { productId: true, minimumStock: true },
      }),
      this.prisma.stockBalance.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId },
        select: { productId: true, quantity: true, reservedQuantity: true },
      }),
    ]);
    const todaySales = sales.filter(({ soldAt }) => soldAt >= today);
    const monthSales = sales.filter(({ soldAt }) => soldAt >= monthStart);
    const monthGross = sumSales(monthSales);
    const [soldGroups, soldProductRows, activeProducts, creditGroups] = await Promise.all([
      this.prisma.saleItem.groupBy({
        by: ['productId'],
        where: { companyId: auth.companyId, saleId: { in: sales.map(({ id }) => id) } },
        _sum: { quantity: true, total: true },
        _count: { id: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 15,
      }),
      this.prisma.saleItem.findMany({
        where: { companyId: auth.companyId, saleId: { in: sales.map(({ id }) => id) } },
        distinct: ['productId'],
        select: { productId: true },
      }),
      this.prisma.product.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          productType: { not: 'service' },
        },
        select: { id: true, code: true, description: true },
        orderBy: { description: 'asc' },
        take: 1000,
      }),
      this.prisma.accountReceivable.groupBy({
        by: ['customerId'],
        where: { companyId: auth.companyId, branchId: auth.branchId, customerId: { not: null } },
        _sum: { amount: true, openAmount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 10,
      }),
    ]);
    const creditCustomers = await this.prisma.customer.findMany({
      where: {
        companyId: auth.companyId,
        id: { in: creditGroups.flatMap(({ customerId }) => (customerId ? [customerId] : [])) },
      },
      select: { id: true, legalName: true, tradeName: true },
    });
    const stockByProduct = new Map<string, Prisma.Decimal>();
    for (const balance of balances)
      stockByProduct.set(
        balance.productId,
        (stockByProduct.get(balance.productId) ?? new Prisma.Decimal(0)).add(
          balance.quantity.sub(balance.reservedQuantity),
        ),
      );
    const daily = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(dayStart);
      date.setUTCDate(date.getUTCDate() + index);
      const key = date.toISOString().slice(0, 10);
      const records = sales.filter(({ soldAt }) => soldAt.toISOString().slice(0, 10) === key);
      return {
        label: `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        value: sumSales(records),
        count: records.length,
      };
    });
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(
        Date.UTC(yearStart.getUTCFullYear(), yearStart.getUTCMonth() + index, 1),
      );
      const records = sales.filter(
        ({ soldAt }) =>
          soldAt.getUTCFullYear() === date.getUTCFullYear() &&
          soldAt.getUTCMonth() === date.getUTCMonth(),
      );
      return {
        label: new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', ''),
        value: sumSales(records),
        count: records.length,
      };
    });
    return {
      updatedAt: now,
      metrics: {
        todayGross: sumSales(todaySales),
        todaySales: todaySales.length,
        monthGross,
        monthSales: monthSales.length,
        averageTicket: monthSales.length
          ? monthGross.div(monthSales.length)
          : new Prisma.Decimal(0),
        pendingOrders,
        openReceivables: receivables._sum.openAmount ?? new Prisma.Decimal(0),
        lowStockProducts: branchSettings.filter(({ productId, minimumStock }) =>
          (stockByProduct.get(productId) ?? new Prisma.Decimal(0)).lte(minimumStock),
        ).length,
      },
      daily,
      monthly,
      topProducts: soldGroups.map((row) => {
        const product = activeProducts.find(({ id }) => id === row.productId);
        return {
          productId: row.productId,
          code: product?.code ?? '',
          description: product?.description ?? 'Produto',
          quantity: row._sum.quantity ?? new Prisma.Decimal(0),
          total: row._sum.total ?? new Prisma.Decimal(0),
          sales: row._count.id,
        };
      }),
      noSalesProducts: activeProducts
        .filter(({ id }) => !soldProductRows.some(({ productId }) => productId === id))
        .slice(0, 15),
      topCreditCustomers: creditGroups.map((row) => {
        const customer = creditCustomers.find(({ id }) => id === row.customerId);
        return {
          customerId: row.customerId,
          name: customer?.tradeName ?? customer?.legalName ?? 'Cliente',
          purchased: row._sum.amount ?? new Prisma.Decimal(0),
          openAmount: row._sum.openAmount ?? new Prisma.Decimal(0),
          purchases: row._count.id,
        };
      }),
    };
  }

  async operations(auth: AccessTokenPayload, input: unknown) {
    const period = cashPeriodQuerySchema.parse(input);
    const to = endOfDay(period.to);
    const sales = await this.prisma.sale.findMany({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        soldAt: { gte: period.from, lte: to },
      },
      orderBy: { soldAt: 'desc' },
      take: 500,
    });
    const orderIds = sales.map(({ orderId }) => orderId);
    const [orders, payments, fiscalDocuments] = await Promise.all([
      this.prisma.order.findMany({ where: { companyId: auth.companyId, id: { in: orderIds } } }),
      this.prisma.payment.findMany({
        where: { companyId: auth.companyId, orderId: { in: orderIds } },
      }),
      this.prisma.fiscalDocument.findMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          saleId: { in: sales.map(({ id }) => id) },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const [customers, sellers, methods] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          companyId: auth.companyId,
          id: { in: orders.flatMap(({ customerId }) => (customerId ? [customerId] : [])) },
        },
        select: { id: true, legalName: true, tradeName: true },
      }),
      this.prisma.employee.findMany({
        where: {
          companyId: auth.companyId,
          id: { in: orders.flatMap(({ sellerId }) => (sellerId ? [sellerId] : [])) },
        },
        select: { id: true, name: true },
      }),
      this.prisma.paymentMethod.findMany({
        where: {
          companyId: auth.companyId,
          id: { in: payments.map(({ paymentMethodId }) => paymentMethodId) },
        },
        select: { id: true, name: true },
      }),
    ]);
    const records = sales.map((sale) => {
      const order = orders.find(({ id }) => id === sale.orderId);
      const salePayments = payments.filter(({ orderId }) => orderId === sale.orderId);
      const fiscal = fiscalDocuments.find(({ saleId }) => saleId === sale.id);
      return {
        id: sale.id,
        number: sale.number,
        soldAt: sale.soldAt,
        status: sale.status,
        origin: order?.origin ?? 'pos',
        customer:
          customers.find(({ id }) => id === order?.customerId)?.tradeName ??
          customers.find(({ id }) => id === order?.customerId)?.legalName ??
          'Consumidor não identificado',
        operator: sellers.find(({ id }) => id === order?.sellerId)?.name ?? 'Não informado',
        total: sale.total,
        feeAmount: salePayments.reduce(
          (sum, item) => sum.add(item.feeAmount),
          new Prisma.Decimal(0),
        ),
        netAmount: salePayments.reduce(
          (sum, item) => sum.add(item.netAmount),
          new Prisma.Decimal(0),
        ),
        payments: salePayments.map((payment) => ({
          method: methods.find(({ id }) => id === payment.paymentMethodId)?.name ?? 'Pagamento',
          amount: payment.amount,
          installments: payment.installments,
        })),
        fiscal: fiscal
          ? {
              type: fiscal.documentType,
              status: fiscal.status,
              number: fiscal.number?.toString() ?? null,
            }
          : null,
      };
    });
    return {
      period: { from: period.from, to },
      totals: {
        sales: records.length,
        gross: records.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0)),
        fees: records.reduce((sum, item) => sum.add(item.feeAmount), new Prisma.Decimal(0)),
        net: records.reduce((sum, item) => sum.add(item.netAmount), new Prisma.Decimal(0)),
      },
      records,
    };
  }

  async tape(auth: AccessTokenPayload, input: unknown) {
    const period = cashPeriodQuerySchema.parse(input);
    const to = endOfDay(period.to);
    const registers = await this.prisma.cashRegister.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId },
      select: { id: true, code: true, name: true },
    });
    const sessions = await this.prisma.cashSession.findMany({
      where: { companyId: auth.companyId, cashRegisterId: { in: registers.map(({ id }) => id) } },
    });
    const movements = await this.prisma.cashMovement.findMany({
      where: {
        companyId: auth.companyId,
        cashSessionId: { in: sessions.map(({ id }) => id) },
        occurredAt: { gte: period.from, lte: to },
      },
      orderBy: { occurredAt: 'desc' },
      take: 1000,
    });
    const [methods, users] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where: {
          companyId: auth.companyId,
          id: {
            in: movements.flatMap(({ paymentMethodId }) =>
              paymentMethodId ? [paymentMethodId] : [],
            ),
          },
        },
        select: { id: true, name: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: movements.map(({ createdBy }) => createdBy) } },
        select: { id: true, displayName: true },
      }),
    ]);
    const entries = movements.map((movement) => {
      const session = sessions.find(({ id }) => id === movement.cashSessionId);
      return {
        id: movement.id,
        occurredAt: movement.occurredAt,
        type: movement.type,
        description: movement.description,
        amount: movement.amount,
        direction: ['payment', 'withdrawal'].includes(movement.type) ? 'out' : 'in',
        method:
          methods.find(({ id }) => id === movement.paymentMethodId)?.name ?? 'Sem finalizador',
        register: registers.find(({ id }) => id === session?.cashRegisterId)?.name ?? 'Caixa',
        operator: users.find(({ id }) => id === movement.createdBy)?.displayName ?? 'Sistema',
      };
    });
    const inflows = entries
      .filter(({ direction }) => direction === 'in')
      .reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    const outflows = entries
      .filter(({ direction }) => direction === 'out')
      .reduce((sum, item) => sum.add(item.amount), new Prisma.Decimal(0));
    return {
      period: { from: period.from, to },
      totals: { entries: entries.length, inflows, outflows, balance: inflows.sub(outflows) },
      entries,
    };
  }

  async configuration(auth: AccessTokenPayload) {
    const [cardOperators, paymentMethods] = await Promise.all([
      this.prisma.cardOperator.findMany({
        where: { companyId: auth.companyId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.paymentMethod.findMany({
        where: { companyId: auth.companyId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }],
      }),
    ]);
    return { cardOperators, paymentMethods };
  }

  async createCardOperator(auth: AccessTokenPayload, input: unknown) {
    const data = cardOperatorSchema.parse(input);
    const duplicate = await this.prisma.cardOperator.findFirst({
      where: { companyId: auth.companyId, code: data.code },
    });
    if (duplicate) throw new ConflictException('Código da operadora já cadastrado');
    const now = new Date();
    return this.prisma.cardOperator.create({
      data: { id: uuidV7(), companyId: auth.companyId, ...data, createdAt: now, updatedAt: now },
    });
  }

  async updateCardOperator(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = updateCardOperatorSchema.parse(input);
    const current = await this.prisma.cardOperator.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!current) throw new NotFoundException('Operadora de cartão não encontrada');
    if (data.code && data.code !== current.code) {
      const duplicate = await this.prisma.cardOperator.findFirst({
        where: { companyId: auth.companyId, code: data.code, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Código da operadora já cadastrado');
    }
    return this.prisma.cardOperator.update({
      where: { id },
      data: {
        ...(defined(data) as Prisma.CardOperatorUncheckedUpdateInput),
        updatedAt: new Date(),
      },
    });
  }

  async createPaymentMethod(auth: AccessTokenPayload, input: unknown) {
    const data = paymentMethodSchema.parse(input);
    await this.validateCardOperator(auth, data.cardOperatorId);
    const duplicate = await this.prisma.paymentMethod.findFirst({
      where: { companyId: auth.companyId, code: data.code },
    });
    if (duplicate) throw new ConflictException('Código do finalizador já cadastrado');
    const now = new Date();
    return this.prisma.paymentMethod.create({
      data: { id: uuidV7(), companyId: auth.companyId, ...data, createdAt: now, updatedAt: now },
    });
  }

  async updatePaymentMethod(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = updatePaymentMethodSchema.parse(input);
    const current = await this.prisma.paymentMethod.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!current) throw new NotFoundException('Finalizador de pagamento não encontrado');
    await this.validateCardOperator(auth, data.cardOperatorId);
    if (data.code && data.code !== current.code) {
      const duplicate = await this.prisma.paymentMethod.findFirst({
        where: { companyId: auth.companyId, code: data.code, id: { not: id } },
      });
      if (duplicate) throw new ConflictException('Código do finalizador já cadastrado');
    }
    return this.prisma.paymentMethod.update({
      where: { id },
      data: {
        ...(defined(data) as Prisma.PaymentMethodUncheckedUpdateInput),
        updatedAt: new Date(),
      },
    });
  }

  private async validateCardOperator(auth: AccessTokenPayload, id: string | null | undefined) {
    if (!id) return;
    const operator = await this.prisma.cardOperator.findFirst({
      where: { id, companyId: auth.companyId, active: true },
    });
    if (!operator) throw new NotFoundException('Operadora de cartão não encontrada');
  }

  async overview(auth: AccessTokenPayload) {
    const [registers, methods] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.paymentMethod.findMany({
        where: { companyId: auth.companyId, active: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const sessions = await this.prisma.cashSession.findMany({
      where: { companyId: auth.companyId, cashRegisterId: { in: registers.map(({ id }) => id) } },
      orderBy: { openedAt: 'desc' },
      take: 30,
    });
    return {
      registers,
      paymentMethods: methods,
      sessions: await Promise.all(
        sessions.map((session) => this.summary(session, registers, methods, auth.companyId)),
      ),
    };
  }

  async createRegister(auth: AccessTokenPayload, input: unknown) {
    const data = createCashRegisterSchema.parse(input);
    const now = new Date();
    return this.prisma.cashRegister.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        ...data,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async open(auth: AccessTokenPayload, input: unknown) {
    const data = openCashSchema.parse(input);
    const register = await this.prisma.cashRegister.findFirst({
      where: {
        id: data.registerId,
        companyId: auth.companyId,
        branchId: auth.branchId,
        active: true,
      },
    });
    if (!register) throw new NotFoundException('Caixa não encontrado na filial');
    const existing = await this.prisma.cashSession.findFirst({
      where: { companyId: auth.companyId, cashRegisterId: register.id, status: 'open' },
    });
    if (existing) throw new ConflictException('Este caixa já possui uma sessão aberta');
    const cashMethod = await this.prisma.paymentMethod.findFirst({
      where: { companyId: auth.companyId, active: true, type: 'cash' },
    });
    const now = new Date();
    return this.prisma.$transaction(
      async (tx) => {
        const session = await tx.cashSession.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            cashRegisterId: register.id,
            operatorId: auth.sub,
            status: 'open',
            openingAmount: data.openingAmount,
            openedAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        if (data.openingAmount > 0)
          await tx.cashMovement.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              cashSessionId: session.id,
              paymentId: null,
              paymentMethodId: cashMethod?.id ?? null,
              type: 'opening',
              amount: data.openingAmount,
              description: 'Saldo inicial',
              occurredAt: now,
              createdBy: auth.sub,
              createdAt: now,
              updatedAt: now,
            },
          });
        await this.audit(tx, auth, 'finance.cash.open', session.id, {
          openingAmount: data.openingAmount,
        });
        return session;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async movement(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = cashMovementSchema.parse(input);
    const session = await this.ownedSession(auth, id, 'open');
    if (session.operatorId !== auth.sub)
      throw new ConflictException('Somente o operador pode movimentar este caixa');
    if (data.paymentMethodId) {
      const method = await this.prisma.paymentMethod.findFirst({
        where: { id: data.paymentMethodId, companyId: auth.companyId, active: true },
      });
      if (!method) throw new NotFoundException('Forma de pagamento não encontrada');
    }
    const now = new Date();
    return this.prisma.cashMovement.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        cashSessionId: id,
        paymentId: null,
        paymentMethodId: data.paymentMethodId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        occurredAt: now,
        createdBy: auth.sub,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  async close(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = closeCashSchema.parse(input);
    const session = await this.ownedSession(auth, id, 'open');
    if (session.operatorId !== auth.sub)
      throw new ConflictException('Somente o operador pode fechar este caixa');
    const methods = await this.prisma.paymentMethod.findMany({
      where: {
        companyId: auth.companyId,
        id: { in: data.counts.map(({ paymentMethodId }) => paymentMethodId) },
      },
    });
    if (methods.length !== data.counts.length)
      throw new NotFoundException('Forma de pagamento não encontrada');
    const movements = await this.prisma.cashMovement.findMany({
      where: { companyId: auth.companyId, cashSessionId: id },
    });
    const now = new Date();
    const rows = data.counts.map((count) => {
      const system = movements
        .filter(({ paymentMethodId }) => paymentMethodId === count.paymentMethodId)
        .reduce(
          (sum, movement) =>
            sum.add(
              ['payment', 'withdrawal'].includes(movement.type)
                ? movement.amount.negated()
                : movement.amount,
            ),
          new Prisma.Decimal(0),
        );
      const counted = new Prisma.Decimal(count.countedAmount);
      return { ...count, system, counted, difference: counted.sub(system) };
    });
    return this.prisma.$transaction(
      async (tx) => {
        await tx.cashClosingCount.createMany({
          data: rows.map((row) => ({
            id: uuidV7(),
            companyId: auth.companyId,
            cashSessionId: id,
            paymentMethodId: row.paymentMethodId,
            systemAmount: row.system,
            countedAmount: row.counted,
            difference: row.difference,
            createdAt: now,
            updatedAt: now,
          })),
        });
        const closed = await tx.cashSession.update({
          where: { id },
          data: { status: 'closed', closedAt: now, updatedAt: now },
        });
        await this.audit(tx, auth, 'finance.cash.close', id, { counts: rows });
        return closed;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reopen(auth: AccessTokenPayload, id: string) {
    const session = await this.ownedSession(auth, id, 'closed');
    const open = await this.prisma.cashSession.findFirst({
      where: { companyId: auth.companyId, cashRegisterId: session.cashRegisterId, status: 'open' },
    });
    if (open) throw new ConflictException('Já existe outra sessão aberta neste caixa');
    return this.prisma.$transaction(async (tx) => {
      await tx.cashClosingCount.deleteMany({
        where: { companyId: auth.companyId, cashSessionId: id },
      });
      const reopened = await tx.cashSession.update({
        where: { id },
        data: { status: 'open', closedAt: null, updatedAt: new Date() },
      });
      await this.audit(tx, auth, 'finance.cash.reopen', id, {});
      return reopened;
    });
  }

  private async ownedSession(auth: AccessTokenPayload, id: string, status: string) {
    const registers = await this.prisma.cashRegister.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId },
      select: { id: true },
    });
    const session = await this.prisma.cashSession.findFirst({
      where: {
        id,
        companyId: auth.companyId,
        cashRegisterId: { in: registers.map(({ id: registerId }) => registerId) },
        status,
      },
    });
    if (!session) throw new NotFoundException('Sessão de caixa não encontrada');
    return session;
  }
  private async summary(
    session: {
      id: string;
      cashRegisterId: string;
      operatorId: string;
      status: string;
      openingAmount: Prisma.Decimal;
      openedAt: Date;
      closedAt: Date | null;
    },
    registers: Array<{ id: string; code: string; name: string }>,
    methods: Array<{ id: string; name: string }>,
    companyId: string,
  ) {
    const movements = await this.prisma.cashMovement.findMany({
      where: { companyId, cashSessionId: session.id },
      orderBy: { occurredAt: 'desc' },
    });
    const totals = methods
      .map((method) => ({
        paymentMethodId: method.id,
        methodName: method.name,
        amount: movements
          .filter(({ paymentMethodId }) => paymentMethodId === method.id)
          .reduce(
            (sum, movement) =>
              sum.add(
                ['payment', 'withdrawal'].includes(movement.type)
                  ? movement.amount.negated()
                  : movement.amount,
              ),
            new Prisma.Decimal(0),
          ),
      }))
      .filter(({ amount }) => !amount.isZero());
    return {
      ...session,
      register: registers.find(({ id }) => id === session.cashRegisterId),
      totals,
      movements,
    };
  }
  private audit(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    action: string,
    entityId: string,
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
        entityType: 'cash_session',
        entityId,
        afterData: JSON.parse(JSON.stringify(afterData)) as Prisma.InputJsonValue,
        occurredAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

function defined<T extends object>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function endOfDay(value: Date) {
  const result = new Date(value);
  result.setUTCHours(23, 59, 59, 999);
  return result;
}

function sumSales(records: Array<{ total: Prisma.Decimal }>) {
  return records.reduce((sum, record) => sum.add(record.total), new Prisma.Decimal(0));
}
