import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import {
  createBomSchema,
  createProductionOrderSchema,
  finalizeProductionSchema,
  productionListSchema,
  transitionProductionSchema,
} from './production.schemas';

@Injectable()
export class ProductionService {
  constructor(private readonly prisma: PrismaService) {}

  async lookups(auth: AccessTokenPayload) {
    const [products, units, warehouses] = await Promise.all([
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
          unitId: true,
          productType: true,
        },
      }),
      this.prisma.unit.findMany({ where: { companyId: auth.companyId }, orderBy: { name: 'asc' } }),
      this.prisma.warehouse.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId },
        select: { id: true },
      }),
    ]);
    const locations = await this.prisma.stockLocation.findMany({
      where: { companyId: auth.companyId, warehouseId: { in: warehouses.map(({ id }) => id) } },
      orderBy: { name: 'asc' },
    });
    const balances = await this.prisma.stockBalance.findMany({
      where: { companyId: auth.companyId, branchId: auth.branchId, quantity: { gt: 0 } },
      select: {
        locationId: true,
        productId: true,
        lotId: true,
        quantity: true,
        reservedQuantity: true,
      },
    });
    const lotIds = balances.flatMap(({ lotId }) => (lotId ? [lotId] : []));
    const lots = await this.prisma.stockLot.findMany({
      where: { companyId: auth.companyId, id: { in: lotIds } },
      orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }],
    });
    return {
      products,
      units,
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

  async createBom(auth: AccessTokenPayload, input: unknown) {
    const data = createBomSchema.parse(input);
    const ids = [data.productId, ...data.items.map(({ componentProductId }) => componentProductId)];
    const [products, units] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, id: { in: ids }, active: true, deletedAt: null },
      }),
      this.prisma.unit.findMany({
        where: { companyId: auth.companyId, id: { in: data.items.map(({ unitId }) => unitId) } },
        select: { id: true },
      }),
    ]);
    if (products.length !== new Set(ids).size)
      throw new NotFoundException('Produto da ficha técnica não encontrado');
    const finished = products.find(({ id }) => id === data.productId);
    if (finished?.productType !== 'manufactured')
      throw new ConflictException('A ficha técnica exige produto do tipo fabricado');
    if (units.length !== new Set(data.items.map(({ unitId }) => unitId)).size)
      throw new NotFoundException('Unidade da ficha técnica não encontrada');
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const aggregate = await tx.bomHeader.aggregate({
        where: { companyId: auth.companyId, productId: data.productId },
        _max: { version: true },
      });
      await tx.bomHeader.updateMany({
        where: { companyId: auth.companyId, productId: data.productId, active: true },
        data: { active: false, updatedAt: now },
      });
      const bom = await tx.bomHeader.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          productId: data.productId,
          version: (aggregate._max.version ?? 0) + 1,
          yieldQuantity: new Prisma.Decimal(data.yieldQuantity),
          expectedLossPercent: new Prisma.Decimal(data.expectedLossPercent),
          active: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.bomItem.createMany({
        data: data.items.map((item) => ({
          id: uuidV7(),
          companyId: auth.companyId,
          bomId: bom.id,
          componentProductId: item.componentProductId,
          unitId: item.unitId,
          quantity: new Prisma.Decimal(item.quantity),
          lossPercent: new Prisma.Decimal(item.lossPercent),
          createdAt: now,
          updatedAt: now,
        })),
      });
      await this.audit(tx, auth, 'production.bom.create', 'bom_header', bom.id, null, {
        productId: bom.productId,
        version: bom.version,
        itemCount: data.items.length,
      });
      return bom;
    });
    return (await this.listBoms(auth)).find(({ id }) => id === result.id);
  }

  async listBoms(auth: AccessTokenPayload) {
    const headers = await this.prisma.bomHeader.findMany({
      where: { companyId: auth.companyId },
      orderBy: [{ productId: 'asc' }, { version: 'desc' }],
    });
    const items = await this.prisma.bomItem.findMany({
      where: { companyId: auth.companyId, bomId: { in: headers.map(({ id }) => id) } },
    });
    const products = await this.prisma.product.findMany({
      where: {
        companyId: auth.companyId,
        id: {
          in: [
            ...new Set([
              ...headers.map(({ productId }) => productId),
              ...items.map(({ componentProductId }) => componentProductId),
            ]),
          ],
        },
      },
      select: { id: true, code: true, description: true },
    });
    return headers.map((header) => ({
      ...header,
      product: this.productLabel(products, header.productId),
      items: items
        .filter(({ bomId }) => bomId === header.id)
        .map((item) => ({
          ...item,
          component: this.productLabel(products, item.componentProductId),
        })),
    }));
  }

  async createOrder(auth: AccessTokenPayload, input: unknown) {
    const data = createProductionOrderSchema.parse(input);
    const bom = await this.prisma.bomHeader.findFirst({
      where: { id: data.bomId, companyId: auth.companyId, active: true },
    });
    if (!bom) throw new NotFoundException('Ficha técnica ativa não encontrada');
    const now = new Date();
    const id = uuidV7();
    const number = `OP-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${id.slice(0, 6).toUpperCase()}`;
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.productionOrder.create({
        data: {
          id,
          companyId: auth.companyId,
          branchId: auth.branchId,
          bomId: bom.id,
          productId: bom.productId,
          number,
          status: 'planned',
          plannedQuantity: new Prisma.Decimal(data.plannedQuantity),
          producedQuantity: 0,
          plannedAt: data.plannedAt,
          createdAt: now,
          updatedAt: now,
        },
      });
      await this.audit(tx, auth, 'production.order.create', 'production_order', created.id, null, {
        number,
        bomId: bom.id,
        plannedQuantity: data.plannedQuantity,
      });
      return created;
    });
    return this.getOrder(auth, order.id);
  }

  async listOrders(auth: AccessTokenPayload, query: unknown) {
    const page = productionListSchema.parse(query);
    const where: Prisma.ProductionOrderWhereInput = {
      companyId: auth.companyId,
      branchId: auth.branchId,
      ...(page.status === 'all' ? {} : { status: page.status }),
    };
    const [orders, total] = await Promise.all([
      this.prisma.productionOrder.findMany({
        where,
        orderBy: [{ plannedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.productionOrder.count({ where }),
    ]);
    const products = await this.prisma.product.findMany({
      where: { companyId: auth.companyId, id: { in: orders.map(({ productId }) => productId) } },
      select: { id: true, code: true, description: true },
    });
    return {
      items: orders.map((order) => ({
        ...order,
        product: this.productLabel(products, order.productId),
      })),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async getOrder(auth: AccessTokenPayload, id: string) {
    const order = await this.order(auth, id);
    const [header, items, consumptions, outputs, balances] = await Promise.all([
      this.prisma.bomHeader.findFirst({ where: { id: order.bomId, companyId: auth.companyId } }),
      this.prisma.bomItem.findMany({ where: { bomId: order.bomId, companyId: auth.companyId } }),
      this.prisma.productionConsumption.findMany({
        where: { productionOrderId: id, companyId: auth.companyId },
      }),
      this.prisma.productionOutput.findMany({
        where: { productionOrderId: id, companyId: auth.companyId },
      }),
      this.prisma.stockBalance.findMany({
        where: { companyId: auth.companyId, branchId: auth.branchId },
      }),
    ]);
    if (!header) throw new ConflictException('Ficha técnica da ordem não encontrada');
    const productIds = [
      ...new Set([order.productId, ...items.map(({ componentProductId }) => componentProductId)]),
    ];
    const [products, lots] = await Promise.all([
      this.prisma.product.findMany({
        where: { companyId: auth.companyId, id: { in: productIds } },
        select: { id: true, code: true, description: true, controlsLot: true },
      }),
      this.prisma.stockLot.findMany({
        where: { companyId: auth.companyId, id: { in: outputs.map(({ lotId }) => lotId) } },
        select: { id: true, lotNumber: true },
      }),
    ]);
    const factor = order.plannedQuantity.div(header.yieldQuantity);
    const bom = {
      ...header,
      product: this.productLabel(products, header.productId),
      items: items.map((item) => ({
        ...item,
        component: this.productLabel(products, item.componentProductId),
      })),
    };
    return {
      ...order,
      product: this.productLabel(products, order.productId),
      bom,
      requirements: items.map((item) => {
        const expected = item.quantity.mul(factor);
        const headerRetention = new Prisma.Decimal(1).sub(header.expectedLossPercent.div(100));
        const itemRetention = new Prisma.Decimal(1).sub(item.lossPercent.div(100));
        const expectedLoss = expected.mul(
          new Prisma.Decimal(1).sub(headerRetention.mul(itemRetention)),
        );
        const available = balances
          .filter(({ productId }) => productId === item.componentProductId)
          .reduce(
            (sum, balance) => sum.add(balance.quantity.sub(balance.reservedQuantity)),
            new Prisma.Decimal(0),
          );
        const product = products.find(({ id: productId }) => productId === item.componentProductId);
        return {
          productId: item.componentProductId,
          product: product ?? {
            code: 'INATIVO',
            description: 'Produto indisponível',
            controlsLot: false,
          },
          expectedQuantity: expected,
          expectedLossQuantity: expectedLoss,
          availableQuantity: available,
          sufficient: available.gte(expected.add(expectedLoss)),
        };
      }),
      consumptions,
      outputs: outputs.map((output) => ({
        ...output,
        lotNumber:
          lots.find(({ id: lotId }) => lotId === output.lotId)?.lotNumber ?? 'Lote indisponível',
      })),
    };
  }

  async transition(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = transitionProductionSchema.parse(input);
    const order = await this.order(auth, id);
    const allowed: Record<string, string> = {
      planned: 'separation',
      separation: 'processing',
      processing: 'quality',
    };
    if (allowed[order.status] !== data.toStatus)
      throw new ConflictException('Transição de produção inválida');
    if (data.toStatus === 'quality' && !data.qualityNotes)
      throw new BadRequestException('Registre a verificação realizada antes da qualidade');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.productionOrder.updateMany({
        where: { id, companyId: auth.companyId, branchId: auth.branchId, status: order.status },
        data: {
          status: data.toStatus,
          ...(data.qualityNotes ? { qualityNotes: data.qualityNotes } : {}),
          ...(data.toStatus === 'processing' ? { startedAt: now } : {}),
          updatedAt: now,
        },
      });
      if (updated.count !== 1)
        throw new ConflictException('A ordem foi alterada por outro usuário');
      await this.audit(
        tx,
        auth,
        'production.order.transition',
        'production_order',
        id,
        { status: order.status },
        { status: data.toStatus, qualityNotes: data.qualityNotes },
      );
    });
    return this.getOrder(auth, id);
  }

  async finalize(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = finalizeProductionSchema.parse(input);
    let attempt = 0;
    while (attempt < 3) {
      try {
        await this.prisma.$transaction(async (tx) => this.finalizeTransaction(tx, auth, id, data), {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
        return this.getOrder(auth, id);
      } catch (error) {
        attempt += 1;
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') ||
          attempt >= 3
        )
          throw error;
      }
    }
    throw new ConflictException('Não foi possível finalizar a produção concorrente');
  }

  private async finalizeTransaction(
    tx: Prisma.TransactionClient,
    auth: AccessTokenPayload,
    id: string,
    data: ReturnType<typeof finalizeProductionSchema.parse>,
  ) {
    const order = await tx.productionOrder.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!order) throw new NotFoundException('Ordem de produção não encontrada');
    if (order.status !== 'quality')
      throw new ConflictException('A ordem deve estar na etapa de qualidade');
    if (new Prisma.Decimal(data.producedQuantity).gt(order.plannedQuantity.mul(2)))
      throw new ConflictException('Produção real acima de 200% do planejado exige nova ordem');
    const location = await tx.stockLocation.findFirst({
      where: { id: data.locationId, companyId: auth.companyId },
    });
    const warehouse = location
      ? await tx.warehouse.findFirst({
          where: { id: location.warehouseId, companyId: auth.companyId, branchId: auth.branchId },
        })
      : null;
    if (!location || !warehouse)
      throw new NotFoundException('Localização não pertence à filial atual');
    const [bomItems, products, outputProduct] = await Promise.all([
      tx.bomItem.findMany({ where: { companyId: auth.companyId, bomId: order.bomId } }),
      tx.product.findMany({
        where: {
          companyId: auth.companyId,
          id: { in: [...new Set(data.consumptions.map(({ productId }) => productId))] },
          deletedAt: null,
        },
      }),
      tx.product.findFirst({
        where: { id: order.productId, companyId: auth.companyId, deletedAt: null },
      }),
    ]);
    if (!outputProduct) throw new ConflictException('Produto acabado indisponível');
    if (outputProduct.controlsExpiry && !data.expiresAt)
      throw new BadRequestException('Validade obrigatória para o produto acabado');
    const componentIds = new Set(bomItems.map(({ componentProductId }) => componentProductId));
    if (data.consumptions.some(({ productId }) => !componentIds.has(productId)))
      throw new BadRequestException('Consumo contém produto fora da ficha técnica');
    if (
      [...componentIds].some(
        (productId) => !data.consumptions.some((item) => item.productId === productId),
      )
    )
      throw new BadRequestException('Informe o consumo real de todos os componentes');
    const now = new Date();
    for (const item of data.consumptions) {
      const product = products.find(({ id: productId }) => productId === item.productId);
      if (!product) throw new NotFoundException('Componente de produção não encontrado');
      if (product.controlsLot !== Boolean(item.lotId))
        throw new BadRequestException(
          product.controlsLot
            ? `Lote obrigatório para ${product.description}`
            : `Produto ${product.description} não aceita lote`,
        );
      if (
        item.lotId &&
        !(await tx.stockLot.findFirst({
          where: { id: item.lotId, companyId: auth.companyId, productId: item.productId },
        }))
      )
        throw new NotFoundException(`Lote inválido para ${product.description}`);
      const deduction = new Prisma.Decimal(item.quantity).add(item.lossQuantity);
      const balance = await tx.stockBalance.findFirst({
        where: {
          companyId: auth.companyId,
          branchId: auth.branchId,
          locationId: location.id,
          productId: item.productId,
          lotId: item.lotId,
        },
      });
      const available = balance
        ? balance.quantity.sub(balance.reservedQuantity)
        : new Prisma.Decimal(0);
      if (!product.allowsNegativeStock && available.lt(deduction))
        throw new ConflictException(`Estoque insuficiente de ${product.description}`);
      if (balance)
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: deduction }, version: { increment: 1 }, updatedAt: now },
        });
      else
        await tx.stockBalance.create({
          data: {
            id: uuidV7(),
            companyId: auth.companyId,
            branchId: auth.branchId,
            locationId: location.id,
            productId: item.productId,
            lotId: item.lotId,
            quantity: deduction.negated(),
            reservedQuantity: 0,
            version: 0,
            createdAt: now,
            updatedAt: now,
          },
        });
      const movement = await tx.stockMovement.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          locationId: location.id,
          productId: item.productId,
          lotId: item.lotId,
          movementType: 'production_consumption',
          quantity: deduction.negated(),
          unitCost: null,
          referenceType: 'production_order',
          referenceId: order.id,
          occurredAt: now,
          createdBy: auth.sub,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.productionConsumption.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          productionOrderId: order.id,
          productId: item.productId,
          lotId: item.lotId,
          quantity: new Prisma.Decimal(item.quantity),
          lossQuantity: new Prisma.Decimal(item.lossQuantity),
          stockMovementId: movement.id,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    let lot = await tx.stockLot.findFirst({
      where: { companyId: auth.companyId, productId: order.productId, lotNumber: data.lotNumber },
    });
    if (lot && lot.sourceId !== order.id)
      throw new ConflictException('Número de lote já utilizado por outra origem');
    lot ??= await tx.stockLot.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        productId: order.productId,
        lotNumber: data.lotNumber,
        manufacturedAt: data.manufacturedAt,
        expiresAt: data.expiresAt,
        sourceType: 'production_order',
        sourceId: order.id,
        createdAt: now,
        updatedAt: now,
      },
    });
    const produced = new Prisma.Decimal(data.producedQuantity);
    const outputBalance = await tx.stockBalance.findFirst({
      where: {
        companyId: auth.companyId,
        branchId: auth.branchId,
        locationId: location.id,
        productId: order.productId,
        lotId: lot.id,
      },
    });
    if (outputBalance)
      await tx.stockBalance.update({
        where: { id: outputBalance.id },
        data: { quantity: { increment: produced }, version: { increment: 1 }, updatedAt: now },
      });
    else
      await tx.stockBalance.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          locationId: location.id,
          productId: order.productId,
          lotId: lot.id,
          quantity: produced,
          reservedQuantity: 0,
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
      });
    const outputMovement = await tx.stockMovement.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        branchId: auth.branchId,
        locationId: location.id,
        productId: order.productId,
        lotId: lot.id,
        movementType: 'production_output',
        quantity: produced,
        unitCost: null,
        referenceType: 'production_order',
        referenceId: order.id,
        occurredAt: now,
        createdBy: auth.sub,
        createdAt: now,
        updatedAt: now,
      },
    });
    await tx.productionOutput.create({
      data: {
        id: uuidV7(),
        companyId: auth.companyId,
        productionOrderId: order.id,
        productId: order.productId,
        lotId: lot.id,
        quantity: produced,
        stockMovementId: outputMovement.id,
        createdAt: now,
        updatedAt: now,
      },
    });
    const updated = await tx.productionOrder.updateMany({
      where: {
        id: order.id,
        companyId: auth.companyId,
        branchId: auth.branchId,
        status: 'quality',
      },
      data: {
        status: 'finalized',
        producedQuantity: produced,
        qualityNotes: data.qualityNotes ?? order.qualityNotes,
        finishedAt: now,
        updatedAt: now,
      },
    });
    if (updated.count !== 1)
      throw new ConflictException('A ordem já foi finalizada por outro usuário');
    await this.audit(
      tx,
      auth,
      'production.order.finalize',
      'production_order',
      order.id,
      { status: order.status, producedQuantity: order.producedQuantity },
      {
        status: 'finalized',
        producedQuantity: produced,
        lotId: lot.id,
        consumptionCount: data.consumptions.length,
      },
    );
  }

  private async order(auth: AccessTokenPayload, id: string) {
    const order = await this.prisma.productionOrder.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!order) throw new NotFoundException('Ordem de produção não encontrada');
    return order;
  }
  private productLabel(
    products: Array<{ id: string; code: string; description: string }>,
    id: string,
  ) {
    return (
      products.find(({ id: productId }) => productId === id) ?? {
        code: 'INATIVO',
        description: 'Produto indisponível',
      }
    );
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
        beforeData: beforeData === null ? Prisma.JsonNull : this.json(beforeData),
        afterData: this.json(afterData),
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
