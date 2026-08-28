import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { calculateSuggestionSchema, suggestionListSchema } from './purchase-suggestion.schemas';

interface MetricRow {
  productId: string;
  code: string;
  description: string;
  minimumStock: Prisma.Decimal | string | number | null;
  maximumStock: Prisma.Decimal | string | number | null;
  availableStock: Prisma.Decimal | string | number | null;
  historySales: Prisma.Decimal | string | number | null;
  recentSales: Prisma.Decimal | string | number | null;
  previousSales: Prisma.Decimal | string | number | null;
  seasonalSales: Prisma.Decimal | string | number | null;
  pendingPurchase: Prisma.Decimal | string | number | null;
  inTransitPurchase: Prisma.Decimal | string | number | null;
  leadDays: number | null;
}

@Injectable()
export class PurchaseSuggestionService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(auth: AccessTokenPayload, input: unknown) {
    const data = calculateSuggestionSchema.parse(input);
    const today = this.today();
    const historyStart = this.addDays(today, -data.historyDays);
    const recentDays = Math.min(30, Math.max(7, Math.floor(data.historyDays / 2)));
    const recentStart = this.addDays(today, -recentDays);
    const previousStart = this.addDays(recentStart, -recentDays);
    const seasonalStart = this.addYears(today, -1);
    const seasonalEnd = this.addDays(seasonalStart, data.forecastDays);
    const rows = await this.metrics(auth, {
      historyStart,
      recentStart,
      previousStart,
      seasonalStart,
      seasonalEnd,
    });
    const now = new Date();
    const suggestionId = uuidV7();
    const items = rows.map((row) =>
      this.item(row, {
        forecastDays: data.forecastDays,
        historyDays: data.historyDays,
        recentDays,
        now,
        suggestionId,
        companyId: auth.companyId,
      }),
    );
    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseSuggestion.create({
        data: {
          id: suggestionId,
          companyId: auth.companyId,
          branchId: auth.branchId,
          forecastDays: data.forecastDays,
          parameters: this.json({
            historyDays: data.historyDays,
            recentDays,
            calculationVersion: 'v1',
          }),
          status: 'calculated',
          calculatedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
      if (items.length)
        await tx.purchaseSuggestionItem.createMany({
          data: items.map((item) => ({
            id: item.id,
            companyId: item.companyId,
            suggestionId: item.suggestionId,
            productId: item.productId,
            averageDailySales: item.averageDailySales,
            availableStock: item.availableStock,
            safetyStock: item.safetyStock,
            pendingPurchase: item.pendingPurchase,
            suggestedQuantity: item.suggestedQuantity,
            explanation: item.explanation,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          })),
        });
      await tx.auditLog.create({
        data: {
          id: uuidV7(),
          companyId: auth.companyId,
          branchId: auth.branchId,
          userId: auth.sub,
          action: 'purchase.suggestion.calculate',
          entityType: 'purchase_suggestion',
          entityId: suggestionId,
          afterData: this.json({
            forecastDays: data.forecastDays,
            historyDays: data.historyDays,
            products: items.length,
            suggestedProducts: items.filter(({ suggestedQuantity }) => suggestedQuantity.gt(0))
              .length,
          }),
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    });
    return this.get(auth, suggestionId);
  }

  async list(auth: AccessTokenPayload, query: unknown) {
    const page = suggestionListSchema.parse(query);
    const where = { companyId: auth.companyId, branchId: auth.branchId };
    const [records, total] = await Promise.all([
      this.prisma.purchaseSuggestion.findMany({
        where,
        orderBy: { calculatedAt: 'desc' },
        skip: (page.page - 1) * page.pageSize,
        take: page.pageSize,
      }),
      this.prisma.purchaseSuggestion.count({ where }),
    ]);
    const ids = records.map(({ id }) => id);
    const items = ids.length
      ? await this.prisma.purchaseSuggestionItem.findMany({
          where: { companyId: auth.companyId, suggestionId: { in: ids } },
          select: { suggestionId: true, suggestedQuantity: true },
        })
      : [];
    return {
      items: records.map((record) => {
        const related = items.filter(({ suggestionId }) => suggestionId === record.id);
        return {
          ...record,
          itemCount: related.length,
          totalSuggestedItems: related.filter(({ suggestedQuantity }) => suggestedQuantity.gt(0))
            .length,
        };
      }),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async get(auth: AccessTokenPayload, id: string) {
    const suggestion = await this.prisma.purchaseSuggestion.findFirst({
      where: { id, companyId: auth.companyId, branchId: auth.branchId },
    });
    if (!suggestion) throw new NotFoundException('Sugestão de compra não encontrada');
    const records = await this.prisma.purchaseSuggestionItem.findMany({
      where: { companyId: auth.companyId, suggestionId: id },
      orderBy: { suggestedQuantity: 'desc' },
    });
    const productIds = records.map(({ productId }) => productId);
    const products = await this.prisma.product.findMany({
      where: { companyId: auth.companyId, id: { in: productIds }, deletedAt: null },
      select: { id: true, code: true, description: true },
    });
    return {
      ...suggestion,
      itemCount: records.length,
      totalSuggestedItems: records.filter(({ suggestedQuantity }) => suggestedQuantity.gt(0))
        .length,
      items: records.map((record) => ({
        ...record,
        product: products.find(({ id: productId }) => productId === record.productId) ?? {
          code: 'INATIVO',
          description: 'Produto indisponível',
        },
      })),
    };
  }

  private async metrics(
    auth: AccessTokenPayload,
    dates: {
      historyStart: Date;
      recentStart: Date;
      previousStart: Date;
      seasonalStart: Date;
      seasonalEnd: Date;
    },
  ) {
    return this.prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      WITH stock AS (
        SELECT product_id, COALESCE(SUM(quantity - reserved_quantity), 0) AS available
        FROM stock_balances WHERE company_id = ${auth.companyId} AND branch_id = ${auth.branchId} GROUP BY product_id
      ), sales_data AS (
        SELECT si.product_id,
          COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${dates.historyStart} AND s.sold_at < ${this.today()}), 0) AS history_sales,
          COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${dates.recentStart} AND s.sold_at < ${this.today()}), 0) AS recent_sales,
          COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${dates.previousStart} AND s.sold_at < ${dates.recentStart}), 0) AS previous_sales,
          COALESCE(SUM(si.quantity) FILTER (WHERE s.sold_at >= ${dates.seasonalStart} AND s.sold_at < ${dates.seasonalEnd}), 0) AS seasonal_sales
        FROM sale_items si JOIN sales s ON s.id = si.sale_id AND s.company_id = si.company_id
        WHERE si.company_id = ${auth.companyId} AND s.branch_id = ${auth.branchId} AND s.status NOT IN ('draft', 'canceled', 'cancelled', 'void')
        GROUP BY si.product_id
      ), purchases AS (
        SELECT poi.product_id,
          COALESCE(SUM(poi.quantity - poi.received_quantity) FILTER (WHERE po.status IN ('approved', 'ordered', 'partial')), 0) AS pending,
          COALESCE(SUM(poi.quantity - poi.received_quantity) FILTER (WHERE po.status = 'in_transit'), 0) AS in_transit
        FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.purchase_order_id AND po.company_id = poi.company_id
        WHERE poi.company_id = ${auth.companyId} AND po.branch_id = ${auth.branchId} AND poi.quantity > poi.received_quantity
        GROUP BY poi.product_id
      ), lead_time AS (
        SELECT sp.product_id, MIN(s.average_lead_days)::integer AS lead_days
        FROM supplier_products sp JOIN suppliers s ON s.id = sp.supplier_id AND s.company_id = sp.company_id
        WHERE sp.company_id = ${auth.companyId} AND s.active = true AND s.deleted_at IS NULL GROUP BY sp.product_id
      )
      SELECT p.id AS "productId", p.code, p.description, COALESCE(bs.minimum_stock, 0) AS "minimumStock", bs.maximum_stock AS "maximumStock",
        COALESCE(st.available, 0) AS "availableStock", COALESCE(sd.history_sales, 0) AS "historySales", COALESCE(sd.recent_sales, 0) AS "recentSales",
        COALESCE(sd.previous_sales, 0) AS "previousSales", COALESCE(sd.seasonal_sales, 0) AS "seasonalSales", COALESCE(pc.pending, 0) AS "pendingPurchase",
        COALESCE(pc.in_transit, 0) AS "inTransitPurchase", COALESCE(lt.lead_days, 0)::integer AS "leadDays"
      FROM products p LEFT JOIN product_branch_settings bs ON bs.product_id = p.id AND bs.company_id = p.company_id AND bs.branch_id = ${auth.branchId} AND bs.active = true
      LEFT JOIN stock st ON st.product_id = p.id LEFT JOIN sales_data sd ON sd.product_id = p.id LEFT JOIN purchases pc ON pc.product_id = p.id LEFT JOIN lead_time lt ON lt.product_id = p.id
      WHERE p.company_id = ${auth.companyId} AND p.active = true AND p.deleted_at IS NULL
      ORDER BY p.description ASC`);
  }

  private item(
    row: MetricRow,
    context: {
      forecastDays: number;
      historyDays: number;
      recentDays: number;
      now: Date;
      suggestionId: string;
      companyId: string;
    },
  ) {
    const average = this.decimal(row.historySales).div(context.historyDays);
    const recent = this.decimal(row.recentSales).div(context.recentDays);
    const previous = this.decimal(row.previousSales).div(context.recentDays);
    const seasonalAverage = this.decimal(row.seasonalSales).div(context.forecastDays);
    const trendFactor = previous.gt(0) ? this.clamp(recent.div(previous).toNumber(), 0.75, 1.5) : 1;
    const seasonalityFactor =
      average.gt(0) && seasonalAverage.gt(0)
        ? this.clamp(seasonalAverage.div(average).toNumber(), 0.75, 1.5)
        : 1;
    const demandFactor = trendFactor * seasonalityFactor;
    const adjustedDaily = average.mul(demandFactor);
    const leadDays = Math.max(0, row.leadDays ?? 0);
    const forecastDemand = adjustedDaily.mul(context.forecastDays);
    const leadTimeDemand = adjustedDaily.mul(leadDays);
    const minimum = this.decimal(row.minimumStock);
    const maximum = row.maximumStock === null ? null : this.decimal(row.maximumStock);
    const safety = Prisma.Decimal.max(minimum, adjustedDaily.mul(Math.max(leadDays, 7)).mul(0.25));
    const grossTarget = forecastDemand.add(leadTimeDemand).add(safety);
    const target = maximum ? Prisma.Decimal.min(grossTarget, maximum) : grossTarget;
    const available = this.decimal(row.availableStock);
    const pending = this.decimal(row.pendingPurchase);
    const transit = this.decimal(row.inTransitPurchase);
    const suggested = Prisma.Decimal.max(
      0,
      target.sub(available).sub(pending).sub(transit),
    ).toDecimalPlaces(6, Prisma.Decimal.ROUND_CEIL);
    const coverage = average.gt(0)
      ? Prisma.Decimal.max(0, available).div(average).toDecimalPlaces(2)
      : null;
    const reason = suggested.gt(0)
      ? maximum && grossTarget.gt(maximum)
        ? 'Reposição necessária, limitada ao estoque máximo configurado.'
        : 'Reposição necessária para cobrir demanda prevista, prazo e segurança.'
      : 'Estoque e compras abertas cobrem o horizonte selecionado.';
    return {
      id: uuidV7(),
      companyId: context.companyId,
      suggestionId: context.suggestionId,
      productId: row.productId,
      averageDailySales: average.toDecimalPlaces(6),
      availableStock: available,
      safetyStock: safety.toDecimalPlaces(6),
      pendingPurchase: pending.add(transit),
      suggestedQuantity: suggested,
      explanation: this.json({
        forecastDemand: forecastDemand.toDecimalPlaces(6).toString(),
        leadTimeDemand: leadTimeDemand.toDecimalPlaces(6).toString(),
        inTransitPurchase: transit.toString(),
        minimumStock: minimum.toString(),
        maximumStock: maximum?.toString() ?? null,
        targetStock: target.toDecimalPlaces(6).toString(),
        daysOfCoverage: coverage?.toString() ?? null,
        leadDays,
        trendFactor,
        seasonalityFactor,
        demandFactor,
        reason,
      }),
      createdAt: context.now,
      updatedAt: context.now,
      product: { code: row.code, description: row.description },
    };
  }

  private decimal(value: Prisma.Decimal | string | number | null): Prisma.Decimal {
    return new Prisma.Decimal(value ?? 0);
  }
  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
  private today(): Date {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }
  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }
  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setUTCFullYear(result.getUTCFullYear() + years);
    return result;
  }
  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
