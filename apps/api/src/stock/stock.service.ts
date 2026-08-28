import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { adjustmentSchema, createLotSchema, fefoSchema, lotListSchema, movementListSchema, stockListSchema } from './stock.schemas';

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(auth: AccessTokenPayload, query: unknown) {
    const page = stockListSchema.parse(query); const where: Prisma.ProductWhereInput = { companyId: auth.companyId, deletedAt: null, active: true, ...(page.search ? { OR: [{ code: { contains: page.search, mode: 'insensitive' } }, { description: { contains: page.search, mode: 'insensitive' } }, { barcode: { contains: page.search } }] } : {}) };
    const [products, total] = await Promise.all([this.prisma.product.findMany({ where, orderBy: { description: 'asc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize, select: { id: true, code: true, description: true, controlsLot: true, controlsExpiry: true } }), this.prisma.product.count({ where })]); const productIds = products.map(({ id }) => id);
    const [balances, settings] = await Promise.all([this.prisma.stockBalance.findMany({ where: { companyId: auth.companyId, branchId: auth.branchId, productId: { in: productIds } } }), this.prisma.productBranchSetting.findMany({ where: { companyId: auth.companyId, branchId: auth.branchId, productId: { in: productIds }, active: true } })]);
    const items = products.map((product) => { const productBalances = balances.filter(({ productId }) => productId === product.id); const quantity = productBalances.reduce((sum, balance) => sum.add(balance.quantity), new Prisma.Decimal(0)); const reserved = productBalances.reduce((sum, balance) => sum.add(balance.reservedQuantity), new Prisma.Decimal(0)); const available = quantity.sub(reserved); const setting = settings.find(({ productId }) => productId === product.id); const minimum = setting?.minimumStock ?? new Prisma.Decimal(0); return { ...product, quantity, reservedQuantity: reserved, availableQuantity: available, minimumStock: minimum, status: quantity.lte(0) ? 'out' as const : available.lte(minimum) ? 'low' as const : 'ok' as const }; });
    return { items, total, page: page.page, pageSize: page.pageSize, summary: { out: items.filter(({ status }) => status === 'out').length, low: items.filter(({ status }) => status === 'low').length, ok: items.filter(({ status }) => status === 'ok').length } };
  }

  async lookups(auth: AccessTokenPayload) {
    const warehouses = await this.prisma.warehouse.findMany({ where: { companyId: auth.companyId, branchId: auth.branchId }, orderBy: { name: 'asc' } }); const warehouseIds = warehouses.map(({ id }) => id);
    const [locations, products, lots] = await Promise.all([this.prisma.stockLocation.findMany({ where: { companyId: auth.companyId, warehouseId: { in: warehouseIds } }, orderBy: { name: 'asc' } }), this.prisma.product.findMany({ where: { companyId: auth.companyId, deletedAt: null, active: true }, orderBy: { description: 'asc' }, take: 100, select: { id: true, code: true, description: true, controlsLot: true, controlsExpiry: true } }), this.prisma.stockLot.findMany({ where: { companyId: auth.companyId }, orderBy: [{ expiresAt: 'asc' }, { lotNumber: 'asc' }], take: 200 })]);
    return { warehouses, locations, products, lots };
  }

  async movements(auth: AccessTokenPayload, query: unknown) {
    const page = movementListSchema.parse(query); const where: Prisma.StockMovementWhereInput = { companyId: auth.companyId, branchId: auth.branchId, ...(page.productId ? { productId: page.productId } : {}), ...(page.movementType ? { movementType: page.movementType } : {}) }; const [items, total] = await Promise.all([this.prisma.stockMovement.findMany({ where, orderBy: { occurredAt: 'desc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }), this.prisma.stockMovement.count({ where })]); const productIds = [...new Set(items.map(({ productId }) => productId))]; const locationIds = [...new Set(items.map(({ locationId }) => locationId))]; const lotIds = items.flatMap(({ lotId }) => lotId ? [lotId] : []);
    const [products, locations, lots] = await Promise.all([this.prisma.product.findMany({ where: { companyId: auth.companyId, id: { in: productIds } }, select: { id: true, code: true, description: true } }), this.prisma.stockLocation.findMany({ where: { companyId: auth.companyId, id: { in: locationIds } }, select: { id: true, code: true, name: true } }), this.prisma.stockLot.findMany({ where: { companyId: auth.companyId, id: { in: lotIds } }, select: { id: true, lotNumber: true, expiresAt: true } })]);
    return { items: items.map((item) => ({ ...item, product: products.find(({ id }) => id === item.productId), location: locations.find(({ id }) => id === item.locationId), lot: lots.find(({ id }) => id === item.lotId) ?? null })), total, page: page.page, pageSize: page.pageSize };
  }

  async lots(auth: AccessTokenPayload, query: unknown) {
    const page = lotListSchema.parse(query); const today = this.today(); const deadline = new Date(today); if (page.status !== 'all' && page.status !== 'expired') deadline.setUTCDate(deadline.getUTCDate() + Number(page.status));
    const statusFilter = page.status === 'expired' ? Prisma.sql`l.expires_at < ${today}` : page.status === 'all' ? Prisma.sql`TRUE` : Prisma.sql`l.expires_at >= ${today} AND l.expires_at <= ${deadline}`;
    type Row = { id: string; productId: string; lotNumber: string; manufacturedAt: Date | null; expiresAt: Date | null; productCode: string; productDescription: string; quantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal; availableQuantity: Prisma.Decimal; total: number };
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT l.id, l.product_id AS "productId", l.lot_number AS "lotNumber", l.manufactured_at AS "manufacturedAt", l.expires_at AS "expiresAt",
        p.code AS "productCode", p.description AS "productDescription", SUM(b.quantity) AS quantity,
        SUM(b.reserved_quantity) AS "reservedQuantity", SUM(b.quantity - b.reserved_quantity) AS "availableQuantity", COUNT(*) OVER()::integer AS total
      FROM stock_lots l JOIN products p ON p.id = l.product_id AND p.company_id = l.company_id
      JOIN stock_balances b ON b.lot_id = l.id AND b.company_id = l.company_id
      WHERE l.company_id = ${auth.companyId} AND b.branch_id = ${auth.branchId} AND p.deleted_at IS NULL
        AND (${page.search === ''} OR p.code ILIKE ${`%${page.search}%`} OR p.description ILIKE ${`%${page.search}%`} OR l.lot_number ILIKE ${`%${page.search}%`})
        AND ${statusFilter}
      GROUP BY l.id, p.code, p.description HAVING SUM(b.quantity - b.reserved_quantity) > 0
      ORDER BY l.expires_at ASC NULLS LAST, p.description ASC, l.lot_number ASC
      OFFSET ${(page.page - 1) * page.pageSize} LIMIT ${page.pageSize}`);
    const summaryRows = await this.prisma.$queryRaw<Array<{ expired: number; within15: number; within30: number; within60: number; within90: number }>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE expires_at < ${today})::integer AS expired,
        COUNT(*) FILTER (WHERE expires_at >= ${today} AND expires_at <= ${this.addDays(today, 15)})::integer AS "within15",
        COUNT(*) FILTER (WHERE expires_at > ${this.addDays(today, 15)} AND expires_at <= ${this.addDays(today, 30)})::integer AS "within30",
        COUNT(*) FILTER (WHERE expires_at > ${this.addDays(today, 30)} AND expires_at <= ${this.addDays(today, 60)})::integer AS "within60",
        COUNT(*) FILTER (WHERE expires_at > ${this.addDays(today, 60)} AND expires_at <= ${this.addDays(today, 90)})::integer AS "within90"
      FROM (SELECT l.id, l.expires_at FROM stock_lots l JOIN stock_balances b ON b.lot_id = l.id AND b.company_id = l.company_id
        WHERE l.company_id = ${auth.companyId} AND b.branch_id = ${auth.branchId} GROUP BY l.id HAVING SUM(b.quantity - b.reserved_quantity) > 0) available_lots`);
    return { items: rows.map((row) => ({ id: row.id, productId: row.productId, lotNumber: row.lotNumber, manufacturedAt: row.manufacturedAt, expiresAt: row.expiresAt, productCode: row.productCode, productDescription: row.productDescription, quantity: row.quantity, reservedQuantity: row.reservedQuantity, availableQuantity: row.availableQuantity, status: this.expiryStatus(row.expiresAt, today) })), total: rows[0]?.total ?? 0, page: page.page, pageSize: page.pageSize, summary: summaryRows[0] ?? { expired: 0, within15: 0, within30: 0, within60: 0, within90: 0 } };
  }

  async fefo(auth: AccessTokenPayload, productId: string, query: unknown) {
    const input = fefoSchema.parse(query); const product = await this.product(auth.companyId, productId); if (!product.controlsLot) throw new ConflictException('Produto não controla lote'); if (input.locationId) await this.location(auth, input.locationId);
    const balances = await this.prisma.stockBalance.findMany({ where: { companyId: auth.companyId, branchId: auth.branchId, productId, lotId: { not: null }, ...(input.locationId ? { locationId: input.locationId } : {}) } }); const lotIds = balances.flatMap(({ lotId }) => lotId ? [lotId] : []); const lots = await this.prisma.stockLot.findMany({ where: { companyId: auth.companyId, productId, id: { in: lotIds } } }); const today = this.today(); const ordered = lots.filter(({ expiresAt }) => expiresAt ? expiresAt >= today : !product.controlsExpiry).sort((left, right) => left.expiresAt === null ? 1 : right.expiresAt === null ? -1 : left.expiresAt.getTime() - right.expiresAt.getTime()); let remaining = new Prisma.Decimal(input.quantity); const allocations: Array<{ lotId: string; lotNumber: string; expiresAt: Date | null; quantity: Prisma.Decimal }> = [];
    for (const lot of ordered) { const available = balances.filter(({ lotId }) => lotId === lot.id).reduce((sum, balance) => sum.add(balance.quantity.sub(balance.reservedQuantity)), new Prisma.Decimal(0)); if (available.lte(0) || remaining.lte(0)) continue; const quantity = Prisma.Decimal.min(available, remaining); allocations.push({ lotId: lot.id, lotNumber: lot.lotNumber, expiresAt: lot.expiresAt, quantity }); remaining = remaining.sub(quantity); }
    return { product: { id: product.id, code: product.code, description: product.description }, requestedQuantity: new Prisma.Decimal(input.quantity), allocations, shortageQuantity: remaining, fulfilled: remaining.eq(0), warning: 'Prévia FEFO: nenhuma reserva ou movimentação foi criada.' };
  }

  async createLot(auth: AccessTokenPayload, input: unknown) {
    const data = createLotSchema.parse(input); const product = await this.product(auth.companyId, data.productId); if (!product.controlsLot) throw new ConflictException('O produto não está configurado para controlar lote'); if (product.controlsExpiry && !data.expiresAt) throw new ConflictException('Validade obrigatória para este produto');
    const now = new Date(); try { return await this.prisma.stockLot.create({ data: { id: uuidV7(), companyId: auth.companyId, ...data, sourceType: 'manual', createdAt: now, updatedAt: now } }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Lote já cadastrado para este produto'); throw error; }
  }

  async adjust(auth: AccessTokenPayload, input: unknown) {
    const data = adjustmentSchema.parse(input); const product = await this.product(auth.companyId, data.productId); const location = await this.location(auth, data.locationId); if (product.controlsLot && !data.lotId) throw new ConflictException('Lote obrigatório para este produto'); if (!product.controlsLot && data.lotId) throw new ConflictException('Produto sem controle de lote não aceita lote'); if (data.lotId && !(await this.prisma.stockLot.findFirst({ where: { id: data.lotId, companyId: auth.companyId, productId: product.id } }))) throw new NotFoundException('Lote não encontrado para o produto');
    const direction = ['entry', 'adjustment_in', 'return_in'].includes(data.movementType) ? 1 : -1; const delta = new Prisma.Decimal(data.quantity).mul(direction); let attempt = 0;
    while (attempt < 3) { try { return await this.prisma.$transaction(async (tx) => { const now = new Date(); const current = await tx.stockBalance.findFirst({ where: { companyId: auth.companyId, branchId: auth.branchId, locationId: location.id, productId: product.id, lotId: data.lotId } }); const quantity = (current?.quantity ?? new Prisma.Decimal(0)).add(delta); const reserved = current?.reservedQuantity ?? new Prisma.Decimal(0); if (!product.allowsNegativeStock && quantity.lt(reserved)) throw new ConflictException('Movimentação deixaria o estoque disponível negativo'); const balance = current ? await tx.stockBalance.update({ where: { id: current.id }, data: { quantity, version: { increment: 1 }, updatedAt: now } }) : await tx.stockBalance.create({ data: { id: uuidV7(), companyId: auth.companyId, branchId: auth.branchId, locationId: location.id, productId: product.id, lotId: data.lotId, quantity, reservedQuantity: 0, version: 0, createdAt: now, updatedAt: now } }); const movementId = uuidV7(); const movement = await tx.stockMovement.create({ data: { id: movementId, companyId: auth.companyId, branchId: auth.branchId, locationId: location.id, productId: product.id, lotId: data.lotId, movementType: data.movementType, quantity: delta, unitCost: data.unitCost === null ? null : new Prisma.Decimal(data.unitCost), referenceType: 'manual_adjustment', referenceId: movementId, occurredAt: now, createdBy: auth.sub, createdAt: now, updatedAt: now } }); await tx.auditLog.create({ data: { id: uuidV7(), companyId: auth.companyId, branchId: auth.branchId, userId: auth.sub, action: 'stock.adjust', entityType: 'stock_movement', entityId: movement.id, beforeData: this.json(current), afterData: this.json({ movement, balance, reason: data.reason }), occurredAt: now, createdAt: now, updatedAt: now } }); return { movement, balance }; }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { attempt += 1; if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') || attempt >= 3) throw error; } }
    throw new ConflictException('Não foi possível concluir a movimentação concorrente');
  }

  private async product(companyId: string, id: string) { const product = await this.prisma.product.findFirst({ where: { id, companyId, deletedAt: null } }); if (!product) throw new NotFoundException('Produto não encontrado'); return product; }
  private async location(auth: AccessTokenPayload, id: string) { const location = await this.prisma.stockLocation.findFirst({ where: { id, companyId: auth.companyId } }); if (!location) throw new NotFoundException('Localização não encontrada'); const warehouse = await this.prisma.warehouse.findFirst({ where: { id: location.warehouseId, companyId: auth.companyId, branchId: auth.branchId } }); if (!warehouse) throw new NotFoundException('Localização não pertence à filial atual'); return location; }
  private today(): Date { const value = new Date(); value.setUTCHours(0, 0, 0, 0); return value; }
  private addDays(date: Date, days: number): Date { const value = new Date(date); value.setUTCDate(value.getUTCDate() + days); return value; }
  private expiryStatus(expiresAt: Date | null, today: Date): 'expired' | '15' | '30' | '60' | '90' | 'valid' | 'none' { if (!expiresAt) return 'none'; const days = Math.ceil((expiresAt.getTime() - today.getTime()) / 86_400_000); if (days < 0) return 'expired'; if (days <= 15) return '15'; if (days <= 30) return '30'; if (days <= 60) return '60'; if (days <= 90) return '90'; return 'valid'; }
  private json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue; }
}
