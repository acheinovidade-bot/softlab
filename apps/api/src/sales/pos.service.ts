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
  customerStatementQuerySchema,
  posCheckoutSchema,
  posSettingsSchema,
  receiveCreditSchema,
} from './pos.schemas';

@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  async lookups(auth: AccessTokenPayload) {
    const [
      customers,
      sellers,
      products,
      paymentMethods,
      cardOperators,
      warehouses,
      settings,
      issuer,
    ] = await Promise.all([
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
        select: { id: true, name: true },
      }),
      this.prisma.product.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          productType: { not: 'service' },
        },
        orderBy: { description: 'asc' },
        take: 1000,
        select: {
          id: true,
          code: true,
          barcode: true,
          description: true,
          unitId: true,
          openPrice: true,
          controlsLot: true,
          controlsExpiry: true,
          selectLotAtPos: true,
        },
      }),
      this.prisma.paymentMethod.findMany({
        where: { companyId: auth.companyId, active: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          cardOperatorId: true,
          maxInstallments: true,
        },
      }),
      this.prisma.cardOperator.findMany({
        where: { companyId: auth.companyId, active: true },
        select: {
          id: true,
          name: true,
          debitRate: true,
          creditRate: true,
          installmentRate: true,
          settlementDays: true,
        },
      }),
      this.prisma.warehouse.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId },
        select: { id: true },
      }),
      this.settings(auth),
      this.receiptIssuer(auth),
    ]);
    const locations = await this.prisma.stockLocation.findMany({
      where: { companyId: auth.companyId, warehouseId: { in: warehouses.map(({ id }) => id) } },
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true },
    });
    const [prices, balances, units] = await Promise.all([
      this.prisma.productPrice.findMany({
        where: {
          companyId: auth.companyId,
          productId: { in: products.map(({ id }) => id) },
          validFrom: { lte: new Date() },
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          AND: [{ OR: [{ branchId: auth.branchId }, { branchId: null }] }],
        },
        orderBy: { validFrom: 'desc' },
      }),
      this.prisma.stockBalance.findMany({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          locationId: { in: locations.map(({ id }) => id) },
        },
      }),
      this.prisma.unit.findMany({
        where: { companyId: auth.companyId, id: { in: products.map(({ unitId }) => unitId) } },
        select: { id: true, code: true },
      }),
    ]);
    const lots = await this.prisma.stockLot.findMany({
      where: {
        companyId: auth.companyId,
        id: { in: balances.flatMap(({ lotId }) => (lotId ? [lotId] : [])) },
      },
      orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }],
    });
    const posBalances = settings.defaultLocationId
      ? balances.filter(({ locationId }) => locationId === settings.defaultLocationId)
      : [];
    return {
      customers: customers.map((item) => ({ id: item.id, name: item.tradeName ?? item.legalName })),
      sellers,
      paymentMethods: paymentMethods.map((method) => {
        const operator = cardOperators.find(({ id }) => id === method.cardOperatorId);
        return {
          ...method,
          cardConfiguration: operator
            ? {
                operatorName: operator.name,
                debitRate: operator.debitRate,
                creditRate: operator.creditRate,
                installmentRate: operator.installmentRate,
                settlementDays: operator.settlementDays,
              }
            : null,
        };
      }),
      locations,
      settings,
      issuer,
      products: products.map((product) => {
        const price = this.priceFor(prices, product.id, auth.branchId);
        const available = posBalances
          .filter(({ productId }) => productId === product.id)
          .reduce(
            (sum, balance) => sum.add(balance.quantity.sub(balance.reservedQuantity)),
            new Prisma.Decimal(0),
          );
        return {
          ...product,
          unitCode: units.find(({ id }) => id === product.unitId)?.code ?? 'UN',
          salePrice: price?.salePrice ?? null,
          availableQuantity: available,
          lots: lots
            .filter(({ productId }) => productId === product.id)
            .map((lot) => ({
              id: lot.id,
              lotNumber: lot.lotNumber,
              expiresAt: lot.expiresAt,
              availableQuantity: posBalances
                .filter(({ lotId }) => lotId === lot.id)
                .reduce(
                  (sum, balance) => sum.add(balance.quantity.sub(balance.reservedQuantity)),
                  new Prisma.Decimal(0),
                ),
            })),
        };
      }),
    };
  }

  async settings(auth: AccessTokenPayload) {
    const current = await this.prisma.posSetting.findUnique({
      where: { companyId_branchId: { companyId: auth.companyId, branchId: auth.branchId } },
    });
    return {
      defaultCustomerId: current?.defaultCustomerId ?? null,
      defaultSellerId: current?.defaultSellerId ?? null,
      sellerMode: current?.sellerMode ?? 'default',
      defaultLocationId: current?.defaultLocationId ?? null,
    };
  }

  async updateSettings(auth: AccessTokenPayload, input: unknown) {
    const data = posSettingsSchema.parse(input);
    const [customer, seller, location] = await Promise.all([
      data.defaultCustomerId
        ? this.prisma.customer.findFirst({
            where: {
              id: data.defaultCustomerId,
              companyId: auth.companyId,
              active: true,
              deletedAt: null,
            },
          })
        : Promise.resolve(true),
      data.defaultSellerId
        ? this.prisma.employee.findFirst({
            where: {
              id: data.defaultSellerId,
              companyId: auth.companyId,
              active: true,
              deletedAt: null,
              OR: [{ branchId: auth.branchId }, { branchId: null }],
            },
          })
        : Promise.resolve(true),
      this.prisma.stockLocation.findFirst({
        where: { id: data.defaultLocationId, companyId: auth.companyId },
      }),
    ]);
    const warehouse = location
      ? await this.prisma.warehouse.findFirst({
          where: { id: location.warehouseId, companyId: auth.companyId, branchId: auth.branchId },
        })
      : null;
    if (!customer) throw new NotFoundException('Cliente padrão não encontrado');
    if (!seller) throw new NotFoundException('Vendedor padrão não encontrado');
    if (!location || !warehouse) throw new NotFoundException('Local padrão fora da filial');
    const now = new Date();
    const saved = await this.prisma.posSetting.upsert({
      where: { companyId_branchId: { companyId: auth.companyId, branchId: auth.branchId } },
      create: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        ...data,
        createdBy: auth.sub,
        updatedBy: auth.sub,
        createdAt: now,
        updatedAt: now,
      },
      update: { ...data, updatedBy: auth.sub, updatedAt: now },
    });
    return {
      defaultCustomerId: saved.defaultCustomerId,
      defaultSellerId: saved.defaultSellerId,
      sellerMode: saved.sellerMode,
      defaultLocationId: saved.defaultLocationId,
    };
  }

  async checkout(auth: AccessTokenPayload, input: unknown, origin: 'pos' | 'food' = 'pos') {
    const data = posCheckoutSchema.parse(input);
    if (
      data.items.some(({ discount }) => discount > 0) &&
      !auth.permissions.includes('sales.pos.discount')
    )
      throw new ForbiddenException('Operador sem permissão para desconto no PDV');
    const replay = await this.replay(auth, data.idempotencyKey, origin);
    if (replay) return replay;
    const issuer = await this.receiptIssuer(auth);
    const [customer, seller, location, methods, products] = await Promise.all([
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
      data.sellerId
        ? this.prisma.employee.findFirst({
            where: {
              id: data.sellerId,
              companyId: auth.companyId,
              active: true,
              deletedAt: null,
              OR: [{ branchId: auth.branchId }, { branchId: null }],
            },
          })
        : Promise.resolve(true),
      this.prisma.stockLocation.findFirst({
        where: { id: data.locationId, companyId: auth.companyId },
      }),
      this.prisma.paymentMethod.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          id: { in: data.payments.map(({ paymentMethodId }) => paymentMethodId) },
        },
      }),
      this.prisma.product.findMany({
        where: {
          companyId: auth.companyId,
          active: true,
          deletedAt: null,
          id: { in: data.items.map(({ productId }) => productId) },
        },
      }),
    ]);
    const warehouse = location
      ? await this.prisma.warehouse.findFirst({
          where: { id: location.warehouseId, companyId: auth.companyId, branchId: auth.branchId },
        })
      : null;
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    if (!seller) throw new NotFoundException('Vendedor não encontrado');
    if (!location || !warehouse) throw new NotFoundException('Localização fora da filial');
    if (methods.length !== data.payments.length)
      throw new NotFoundException('Forma de pagamento não encontrada');
    for (const payment of data.payments) {
      const method = methods.find(({ id }) => id === payment.paymentMethodId);
      if (method && payment.installments > method.maxInstallments)
        throw new BadRequestException(
          `${method.name} permite no máximo ${method.maxInstallments} parcela(s)`,
        );
    }
    const cardOperators = await this.prisma.cardOperator.findMany({
      where: {
        companyId: auth.companyId,
        active: true,
        id: {
          in: methods.flatMap(({ cardOperatorId }) => (cardOperatorId ? [cardOperatorId] : [])),
        },
      },
    });
    if (products.length !== data.items.length)
      throw new NotFoundException('Produto não encontrado');
    const prices = await this.prisma.productPrice.findMany({
      where: {
        companyId: auth.companyId,
        productId: { in: products.map(({ id }) => id) },
        validFrom: { lte: new Date() },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        AND: [{ OR: [{ branchId: auth.branchId }, { branchId: null }] }],
      },
      orderBy: { validFrom: 'desc' },
    });
    const lines = data.items.map((item) => {
      const product = products.find(({ id }) => id === item.productId);
      const price = this.priceFor(prices, item.productId, auth.branchId);
      if (!product || (!price && item.unitPrice === null))
        throw new ConflictException('Produto sem preço vigente');
      if (item.unitPrice !== null && !product.openPrice && !price?.salePrice.eq(item.unitPrice))
        throw new ConflictException(`Preço manual não permitido para ${product.description}`);
      const unitPrice = new Prisma.Decimal(item.unitPrice ?? price?.salePrice ?? 0);
      const gross = unitPrice.mul(item.quantity);
      const discount = new Prisma.Decimal(item.discount);
      if (discount.gt(gross))
        throw new BadRequestException(`Desconto maior que o item ${product.description}`);
      if (price?.minimumPrice && gross.sub(discount).div(item.quantity).lt(price.minimumPrice))
        throw new ConflictException(`Preço abaixo do mínimo para ${product.description}`);
      if (product.selectLotAtPos && !item.lotId)
        throw new BadRequestException(`Selecione o lote de ${product.description}`);
      if (item.lotId && !product.controlsLot)
        throw new BadRequestException(`${product.description} não controla lote`);
      return {
        product,
        lotId: item.lotId,
        quantity: new Prisma.Decimal(item.quantity),
        unitPrice,
        discount,
        total: gross.sub(discount),
      };
    });
    const subtotal = lines.reduce((sum, line) => sum.add(line.total), new Prisma.Decimal(0));
    const total = subtotal.add(data.surcharge).add(data.freight);
    const paid = data.payments.reduce(
      (sum, payment) => sum.add(payment.amount),
      new Prisma.Decimal(0),
    );
    if (!paid.eq(total))
      throw new BadRequestException(`Pagamentos devem totalizar ${total.toFixed(2)}`);
    const creditMethodIds = new Set(
      methods.filter(({ type }) => type === 'credit_account').map(({ id }) => id),
    );
    const creditAmount = data.payments
      .filter(({ paymentMethodId }) => creditMethodIds.has(paymentMethodId))
      .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0));
    const selectedCustomer = typeof customer === 'boolean' ? null : customer;
    let receivableAccount: { id: string } | null = null;
    if (creditAmount.gt(0)) {
      if (!data.customerId || !selectedCustomer)
        throw new BadRequestException('Selecione um cliente para vender no crediário');
      const debt = await this.prisma.accountReceivable.aggregate({
        where: {
          companyId: auth.companyId,
          customerId: data.customerId,
          status: { in: ['open', 'partial'] },
        },
        _sum: { openAmount: true },
      });
      if (
        new Prisma.Decimal(debt._sum.openAmount ?? 0)
          .add(creditAmount)
          .gt(selectedCustomer.creditLimit)
      )
        throw new ConflictException('Limite de crédito do cliente excedido');
      receivableAccount = await this.prisma.chartAccount.findFirst({
        where: { companyId: auth.companyId, code: '1.1.03', active: true },
        select: { id: true },
      });
      if (!receivableAccount)
        throw new ConflictException('Conta contábil do crediário não configurada');
    }
    try {
      return await this.serializable(async (tx) => {
        const existing = await tx.payment.findFirst({
          where: {
            companyId: auth.companyId,
            idempotencyKey: `${origin}:${data.idempotencyKey}:0`,
          },
        });
        if (existing) throw new ConflictException('Checkout já processado; recarregue o PDV');
        const now = new Date();
        const orderId = uuidV7();
        const saleId = uuidV7();
        const orderNumber = `${origin === 'food' ? 'FOOD' : 'PDV'}-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${orderId.slice(0, 6).toUpperCase()}`;
        const saleNumber = `VEN-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${saleId.slice(0, 6).toUpperCase()}`;
        await tx.order.create({
          data: {
            id: orderId,
            companyId: auth.companyId,
            branchId: auth.branchId,
            customerId: data.customerId,
            salesQuoteId: null,
            sellerId: data.sellerId,
            paymentMethodId:
              data.payments.length === 1 ? (data.payments[0]?.paymentMethodId ?? null) : null,
            number: orderNumber,
            origin,
            status: 'completed',
            subtotal: subtotal.add(
              lines.reduce((sum, line) => sum.add(line.discount), new Prisma.Decimal(0)),
            ),
            discount: lines.reduce((sum, line) => sum.add(line.discount), new Prisma.Decimal(0)),
            surcharge: data.surcharge,
            freight: data.freight,
            total,
            notes: data.notes,
            createdAt: now,
            updatedAt: now,
          },
        });
        const orderItems = await Promise.all(
          lines.map((line) =>
            tx.orderItem.create({
              data: {
                id: uuidV7(),
                companyId: auth.companyId,
                orderId,
                productId: line.product.id,
                locationId: data.locationId,
                lotId: line.lotId,
                description: line.product.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                discount: line.discount,
                total: line.total,
                createdAt: now,
                updatedAt: now,
              },
            }),
          ),
        );
        await tx.sale.create({
          data: {
            id: saleId,
            companyId: auth.companyId,
            branchId: auth.branchId,
            orderId,
            number: saleNumber,
            status: 'completed',
            soldAt: now,
            total,
            createdAt: now,
            updatedAt: now,
          },
        });
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const orderItem = orderItems[index];
          if (!line || !orderItem) throw new ConflictException('Item inconsistente no checkout');
          const saleItem = await tx.saleItem.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              saleId,
              orderItemId: orderItem.id,
              productId: line.product.id,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              total: line.total,
              taxSnapshot:
                line.product.taxProfile === null ? Prisma.JsonNull : line.product.taxProfile,
              createdAt: now,
              updatedAt: now,
            },
          });
          const allocations = await this.allocateStock(
            tx,
            auth,
            data.locationId,
            line.product,
            line.quantity,
            line.lotId,
            now,
          );
          if (allocations.length === 1 && allocations[0]?.lotId)
            await tx.orderItem.update({
              where: { id: orderItem.id },
              data: { lotId: allocations[0].lotId, updatedAt: now },
            });
          for (const allocation of allocations) {
            const movement = await tx.stockMovement.create({
              data: {
                id: uuidV7(),
                companyId: auth.companyId,
                branchId: auth.branchId,
                locationId: data.locationId,
                productId: line.product.id,
                lotId: allocation.lotId,
                movementType: 'sale',
                quantity: allocation.quantity.negated(),
                unitCost: null,
                referenceType: 'sale',
                referenceId: saleId,
                occurredAt: now,
                createdBy: auth.sub,
                createdAt: now,
                updatedAt: now,
              },
            });
            if (allocation.lotId)
              await tx.saleItemTrace.create({
                data: {
                  id: uuidV7(),
                  companyId: auth.companyId,
                  saleItemId: saleItem.id,
                  lotId: allocation.lotId,
                  stockMovementId: movement.id,
                  quantity: allocation.quantity,
                  createdAt: now,
                  updatedAt: now,
                },
              });
          }
        }
        const paymentRows = data.payments.map((payment, index) => {
          const method = methods.find(({ id }) => id === payment.paymentMethodId)!;
          const operator = cardOperators.find(({ id }) => id === method.cardOperatorId);
          const rate = operator
            ? method.type === 'debit_card'
              ? operator.debitRate
              : method.type === 'credit_card'
                ? operator.creditRate.add(operator.installmentRate.mul(payment.installments - 1))
                : new Prisma.Decimal(0)
            : new Prisma.Decimal(0);
          const amount = new Prisma.Decimal(payment.amount);
          const feeAmount = amount.mul(rate).div(100).toDecimalPlaces(4);
          return {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            orderId,
            paymentMethodId: payment.paymentMethodId,
            amount,
            installments: payment.installments,
            feeAmount,
            netAmount: amount.sub(feeAmount),
            status: creditMethodIds.has(payment.paymentMethodId) ? 'pending' : 'paid',
            idempotencyKey: `${origin}:${data.idempotencyKey}:${index}`,
            paidAt: creditMethodIds.has(payment.paymentMethodId) ? null : now,
            createdAt: now,
            updatedAt: now,
          };
        });
        await tx.payment.createMany({ data: paymentRows });
        if (creditAmount.gt(0) && data.customerId && receivableAccount) {
          const dueDate = data.creditDueDate
            ? new Date(`${data.creditDueDate}T12:00:00.000Z`)
            : new Date(now.getTime() + 30 * 86_400_000);
          await tx.accountReceivable.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              branchId: auth.branchId,
              customerId: data.customerId,
              orderId,
              chartAccountId: receivableAccount.id,
              costCenterId: null,
              description: `Crediário ${saleNumber}`,
              competenceDate: now,
              dueDate,
              amount: creditAmount,
              openAmount: creditAmount,
              status: 'open',
              createdAt: now,
              updatedAt: now,
            },
          });
        }
        const branchRegisters = await tx.cashRegister.findMany({
          where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
          select: { id: true },
        });
        const cashSession = await tx.cashSession.findFirst({
          where: {
            companyId: auth.companyId,
            operatorId: auth.sub,
            status: 'open',
            cashRegisterId: { in: branchRegisters.map(({ id }) => id) },
          },
          orderBy: { openedAt: 'desc' },
        });
        if (cashSession)
          await tx.cashMovement.createMany({
            data: paymentRows
              .filter(({ status }) => status === 'paid')
              .map((payment) => ({
                id: uuidV7(),
                companyId: auth.companyId,
                cashSessionId: cashSession.id,
                paymentId: payment.id,
                paymentMethodId: payment.paymentMethodId,
                type: 'receipt',
                amount: payment.amount,
                description: `Recebimento ${saleNumber}`,
                occurredAt: now,
                createdBy: auth.sub,
                createdAt: now,
                updatedAt: now,
              })),
          });
        await tx.auditLog.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            userId: auth.sub,
            action: 'sales.pos.checkout',
            entityType: 'sale',
            entityId: saleId,
            afterData: this.json({
              orderId,
              orderNumber,
              saleNumber,
              total,
              itemCount: lines.length,
              paymentCount: data.payments.length,
            }),
            occurredAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        return {
          orderId,
          orderNumber,
          saleId,
          saleNumber,
          total,
          itemCount: lines.length,
          paymentCount: data.payments.length,
          soldAt: now,
          issuer,
        };
      });
    } catch (error) {
      const duplicateCheckout =
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
      if (duplicateCheckout) {
        const completed = await this.replay(auth, data.idempotencyKey, origin);
        if (completed) return completed;
      }
      throw error;
    }
  }

  async customerStatement(auth: AccessTokenPayload, customerId: string, input: unknown) {
    const query = customerStatementQuerySchema.parse(input);
    const to = new Date(query.to);
    to.setUTCHours(23, 59, 59, 999);
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId: auth.companyId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const orders = await this.prisma.order.findMany({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        customerId,
        origin: 'pos',
        createdAt: { gte: query.from, lte: to },
      },
      orderBy: { createdAt: 'desc' },
    });
    const orderIds = orders.map(({ id }) => id);
    const [sales, items, receivables, totalDebt] = await Promise.all([
      this.prisma.sale.findMany({
        where: { companyId: auth.companyId, orderId: { in: orderIds } },
      }),
      this.prisma.orderItem.findMany({
        where: { companyId: auth.companyId, orderId: { in: orderIds } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.accountReceivable.findMany({
        where: { companyId: auth.companyId, customerId, orderId: { in: orderIds } },
      }),
      this.prisma.accountReceivable.aggregate({
        where: { companyId: auth.companyId, customerId, status: { in: ['open', 'partial'] } },
        _sum: { openAmount: true },
      }),
    ]);
    const settlementRows = await this.prisma.financialSettlement.findMany({
      where: { companyId: auth.companyId, receivableId: { in: receivables.map(({ id }) => id) } },
    });
    const coupons = sales.map((sale) => {
      const receivable = receivables.find(({ orderId }) => orderId === sale.orderId);
      const amountPaid = receivable
        ? settlementRows
            .filter(({ receivableId }) => receivableId === receivable.id)
            .reduce((sum, row) => sum.add(row.principalAmount), new Prisma.Decimal(0))
        : new Prisma.Decimal(0);
      return {
        saleId: sale.id,
        saleNumber: sale.number,
        soldAt: sale.soldAt,
        total: sale.total,
        creditAmount: receivable?.amount ?? new Prisma.Decimal(0),
        amountPaid,
        amountDue: receivable?.openAmount ?? new Prisma.Decimal(0),
        receivableId: receivable?.id ?? null,
        items: items
          .filter(({ orderId }) => orderId === sale.orderId)
          .map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
      };
    });
    return {
      customer: {
        id: customer.id,
        name: customer.tradeName ?? customer.legalName,
        creditLimit: customer.creditLimit,
      },
      period: { from: query.from, to },
      totalPurchased: coupons.reduce((sum, coupon) => sum.add(coupon.total), new Prisma.Decimal(0)),
      totalPaid: coupons.reduce((sum, coupon) => sum.add(coupon.amountPaid), new Prisma.Decimal(0)),
      totalDue: totalDebt._sum.openAmount ?? new Prisma.Decimal(0),
      coupons,
    };
  }

  async receiveCredit(auth: AccessTokenPayload, receivableId: string, input: unknown) {
    const data = receiveCreditSchema.parse(input);
    const existing = await this.prisma.financialSettlement.findFirst({
      where: { companyId: auth.companyId, idempotencyKey: `credit:${data.idempotencyKey}` },
    });
    if (existing) return existing;
    const [receivable, method] = await Promise.all([
      this.prisma.accountReceivable.findFirst({
        where: {
          id: receivableId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          status: { in: ['open', 'partial'] },
        },
      }),
      this.prisma.paymentMethod.findFirst({
        where: {
          id: data.paymentMethodId,
          companyId: auth.companyId,
          active: true,
          type: { not: 'credit_account' },
        },
      }),
    ]);
    if (!receivable) throw new NotFoundException('Conta a receber não encontrada');
    if (!method) throw new NotFoundException('Forma de recebimento não encontrada');
    const amount = new Prisma.Decimal(data.amount);
    if (amount.gt(receivable.openAmount))
      throw new BadRequestException('Pagamento maior que o saldo devido');
    const now = new Date();
    return this.serializable(async (tx) => {
      const registers = await tx.cashRegister.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId, active: true },
        select: { id: true },
      });
      const session = await tx.cashSession.findFirst({
        where: {
          companyId: auth.companyId,
          operatorId: auth.sub,
          status: 'open',
          cashRegisterId: { in: registers.map(({ id }) => id) },
        },
      });
      const settlement = await tx.financialSettlement.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          payableId: null,
          receivableId,
          bankAccountId: null,
          cashSessionId: session?.id ?? null,
          paymentMethodId: method.id,
          receivedBy: auth.sub,
          principalAmount: amount,
          interest: 0,
          discount: 0,
          settledAt: now,
          idempotencyKey: `credit:${data.idempotencyKey}`,
          createdAt: now,
          updatedAt: now,
        },
      });
      const remaining = receivable.openAmount.sub(amount);
      await tx.accountReceivable.update({
        where: { id: receivable.id },
        data: {
          openAmount: remaining,
          status: remaining.isZero() ? 'paid' : 'partial',
          updatedAt: now,
        },
      });
      if (receivable.orderId) {
        const payment = await tx.payment.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            orderId: receivable.orderId,
            paymentMethodId: method.id,
            amount,
            status: 'paid',
            idempotencyKey: `credit-receipt:${data.idempotencyKey}`,
            paidAt: now,
            createdAt: now,
            updatedAt: now,
          },
        });
        if (session)
          await tx.cashMovement.create({
            data: {
              id: uuidV7(),
              companyId: auth.companyId,
              cashSessionId: session.id,
              paymentId: payment.id,
              paymentMethodId: method.id,
              type: 'receipt',
              amount,
              description: `Recebimento parcial ${receivable.description}`,
              occurredAt: now,
              createdBy: auth.sub,
              createdAt: now,
              updatedAt: now,
            },
          });
      }
      return settlement;
    });
  }

  private async allocateStock(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    locationId: string,
    product: {
      id: string;
      description: string;
      controlsLot: boolean;
      controlsExpiry: boolean;
      allowsNegativeStock: boolean;
    },
    quantity: Prisma.Decimal,
    selectedLotId: string | null,
    now: Date,
  ) {
    if (!product.controlsLot) {
      const balance = await tx.stockBalance.findFirst({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          locationId,
          productId: product.id,
          lotId: null,
        },
      });
      const available = balance?.quantity.sub(balance.reservedQuantity) ?? new Prisma.Decimal(0);
      if (!product.allowsNegativeStock && available.lt(quantity))
        throw new ConflictException(`Estoque insuficiente para ${product.description}`);
      if (balance)
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: quantity }, version: { increment: 1 }, updatedAt: now },
        });
      else
        await tx.stockBalance.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            locationId,
            productId: product.id,
            lotId: null,
            quantity: quantity.negated(),
            reservedQuantity: 0,
            version: 0,
            createdAt: now,
            updatedAt: now,
          },
        });
      return [{ lotId: null, quantity }];
    }
    const balances = await tx.stockBalance.findMany({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        locationId,
        productId: product.id,
        lotId: { not: null },
      },
    });
    const lots = await tx.stockLot.findMany({
      where: {
        companyId: auth.companyId,
        productId: product.id,
        id: { in: balances.flatMap(({ lotId }) => (lotId ? [lotId] : [])) },
        ...(selectedLotId ? { id: selectedLotId } : {}),
      },
      orderBy: [{ expiresAt: 'asc' }, { manufacturedAt: 'asc' }],
    });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let remaining = quantity;
    const allocations: Array<{ lotId: string; quantity: Prisma.Decimal }> = [];
    for (const lot of lots) {
      if (remaining.lte(0) || (product.controlsExpiry && (!lot.expiresAt || lot.expiresAt < today)))
        continue;
      const balance = balances.find(({ lotId }) => lotId === lot.id);
      if (!balance) continue;
      const available = balance.quantity.sub(balance.reservedQuantity);
      if (available.lte(0)) continue;
      const used = Prisma.Decimal.min(available, remaining);
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { decrement: used }, version: { increment: 1 }, updatedAt: now },
      });
      allocations.push({ lotId: lot.id, quantity: used });
      remaining = remaining.sub(used);
    }
    if (remaining.gt(0))
      throw new ConflictException(
        selectedLotId
          ? `Lote selecionado sem saldo válido para ${product.description}`
          : `Estoque FEFO insuficiente para ${product.description}`,
      );
    return allocations;
  }
  private priceFor(
    prices: Array<{
      productId: string;
      branchId: string | null;
      salePrice: Prisma.Decimal;
      minimumPrice: Prisma.Decimal | null;
    }>,
    productId: string,
    branchId: string,
  ) {
    return (
      prices.find((price) => price.productId === productId && price.branchId === branchId) ??
      prices.find((price) => price.productId === productId && price.branchId === null)
    );
  }
  private async replay(auth: AccessTokenPayload, key: string, origin: 'pos' | 'food') {
    const payment = await this.prisma.payment.findFirst({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        idempotencyKey: `${origin}:${key}:0`,
      },
    });
    if (!payment) return null;
    const [order, sale, itemCount, paymentCount, issuer] = await Promise.all([
      this.prisma.order.findFirst({
        where: { id: payment.orderId, companyId: auth.companyId, branchId: auth.branchId },
      }),
      this.prisma.sale.findFirst({
        where: { orderId: payment.orderId, companyId: auth.companyId, branchId: auth.branchId },
      }),
      this.prisma.orderItem.count({
        where: { orderId: payment.orderId, companyId: auth.companyId },
      }),
      this.prisma.payment.count({ where: { orderId: payment.orderId, companyId: auth.companyId } }),
      this.receiptIssuer(auth),
    ]);
    if (!order || !sale) throw new ConflictException('Checkout idempotente inconsistente');
    return {
      orderId: order.id,
      orderNumber: order.number,
      saleId: sale.id,
      saleNumber: sale.number,
      total: sale.total,
      itemCount,
      paymentCount,
      soldAt: sale.soldAt,
      issuer,
    };
  }
  private async receiptIssuer(auth: AccessTokenPayload) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: auth.branchId, companyId: auth.companyId, deletedAt: null },
      select: { tradeName: true, legalName: true, taxId: true },
    });
    if (!branch) throw new NotFoundException('Dados da empresa emitente não encontrados');
    return branch;
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
    throw new ConflictException('Conflito concorrente no checkout');
  }
  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
