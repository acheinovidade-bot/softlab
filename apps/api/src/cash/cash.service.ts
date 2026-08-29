import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  cardOperatorSchema,
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
