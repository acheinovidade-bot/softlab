import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload } from '../auth/auth.types';
import { uuidV7 } from '../common/uuid-v7';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { addressesSchema, createCustomerSchema, createEmployeeSchema, createSupplierSchema, listSchema, supplierProductSearchSchema, supplierProductsSchema, updateCustomerSchema, updateEmployeeSchema, updateSupplierSchema } from './master-data.schemas';

@Injectable()
export class MasterDataService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomers(auth: AccessTokenPayload, query: unknown) {
    const page = listSchema.parse(query); const where: Prisma.CustomerWhereInput = { companyId: auth.companyId, deletedAt: null, ...(page.status === 'all' ? {} : { active: page.status === 'active' }), ...(page.search ? { OR: [{ legalName: { contains: page.search, mode: 'insensitive' } }, { tradeName: { contains: page.search, mode: 'insensitive' } }, { taxId: { contains: page.search } }] } : {}) };
    const [items, total] = await Promise.all([this.prisma.customer.findMany({ where, orderBy: { legalName: 'asc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }), this.prisma.customer.count({ where })]);
    return { items, total, page: page.page, pageSize: page.pageSize };
  }

  async getCustomer(auth: AccessTokenPayload, id: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id, companyId: auth.companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Cliente não encontrado');
    const links = await this.prisma.customerAddress.findMany({ where: { customerId: id } });
    const addresses = await this.prisma.address.findMany({ where: { companyId: auth.companyId, id: { in: links.map(({ addressId }) => addressId) } } });
    return { ...customer, addresses: links.map((link) => ({ ...addresses.find(({ id: addressId }) => addressId === link.addressId), type: link.type, isDefault: link.isDefault })).filter(({ id: addressId }) => Boolean(addressId)) };
  }

  async createCustomer(auth: AccessTokenPayload, input: unknown) {
    const { addresses, ...data } = createCustomerSchema.parse(input);
    return this.unique(async () => this.prisma.$transaction(async (tx) => {
      const now = new Date(); const customer = await tx.customer.create({ data: { id: uuidV7(), companyId: auth.companyId, ...data, creditLimit: new Prisma.Decimal(data.creditLimit), createdAt: now, updatedAt: now } });
      await this.createAddresses(tx, auth.companyId, customer.id, addresses, now);
      await this.audit(tx, auth, 'customer.create', 'customer', customer.id, null, { ...customer, addresses }); return customer;
    }));
  }

  async updateCustomer(auth: AccessTokenPayload, id: string, input: unknown) {
    const data = updateCustomerSchema.parse(input); const before = await this.customer(auth.companyId, id);
    createCustomerSchema.parse({ personType: data.personType ?? before.personType, taxId: data.taxId === undefined ? before.taxId : data.taxId, legalName: data.legalName ?? before.legalName, tradeName: data.tradeName === undefined ? before.tradeName : data.tradeName, phone: data.phone === undefined ? before.phone : data.phone, whatsapp: data.whatsapp === undefined ? before.whatsapp : data.whatsapp, email: data.email === undefined ? before.email : data.email, creditLimit: data.creditLimit ?? before.creditLimit.toNumber(), notes: data.notes === undefined ? before.notes : data.notes, active: data.active ?? before.active, addresses: [] });
    const update = this.defined({ ...data, ...(data.creditLimit === undefined ? {} : { creditLimit: new Prisma.Decimal(data.creditLimit) }), updatedAt: new Date() }) as Prisma.CustomerUncheckedUpdateInput;
    return this.unique(async () => this.prisma.$transaction(async (tx) => { const after = await tx.customer.update({ where: { id }, data: update }); await this.audit(tx, auth, 'customer.update', 'customer', id, before, after); return after; }));
  }

  async replaceCustomerAddresses(auth: AccessTokenPayload, id: string, input: unknown): Promise<void> {
    const { addresses } = addressesSchema.parse(input); await this.customer(auth.companyId, id);
    await this.prisma.$transaction(async (tx) => { const before = await tx.customerAddress.findMany({ where: { customerId: id } }); const addressIds = before.map(({ addressId }) => addressId); await tx.customerAddress.deleteMany({ where: { customerId: id } }); if (addressIds.length) await tx.address.deleteMany({ where: { companyId: auth.companyId, id: { in: addressIds } } }); const now = new Date(); await this.createAddresses(tx, auth.companyId, id, addresses, now); await this.audit(tx, auth, 'customer.addresses.replace', 'customer', id, before, addresses); });
  }

  async listSuppliers(auth: AccessTokenPayload, query: unknown) { const page = listSchema.parse(query); const where: Prisma.SupplierWhereInput = { companyId: auth.companyId, deletedAt: null, ...(page.status === 'all' ? {} : { active: page.status === 'active' }), ...(page.search ? { OR: [{ legalName: { contains: page.search, mode: 'insensitive' } }, { tradeName: { contains: page.search, mode: 'insensitive' } }, { taxId: { contains: page.search } }] } : {}) }; const [items, total] = await Promise.all([this.prisma.supplier.findMany({ where, orderBy: { legalName: 'asc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }), this.prisma.supplier.count({ where })]); return { items, total, page: page.page, pageSize: page.pageSize }; }
  async createSupplier(auth: AccessTokenPayload, input: unknown) { const data = createSupplierSchema.parse(input); return this.unique(async () => this.prisma.$transaction(async (tx) => { const now = new Date(); const item = await tx.supplier.create({ data: { id: uuidV7(), companyId: auth.companyId, ...data, createdAt: now, updatedAt: now } }); await this.audit(tx, auth, 'supplier.create', 'supplier', item.id, null, item); return item; })); }
  async updateSupplier(auth: AccessTokenPayload, id: string, input: unknown) { const data = updateSupplierSchema.parse(input); const before = await this.supplier(auth.companyId, id); const update = this.defined({ ...data, updatedAt: new Date() }) as Prisma.SupplierUncheckedUpdateInput; return this.unique(async () => this.prisma.$transaction(async (tx) => { const after = await tx.supplier.update({ where: { id }, data: update }); await this.audit(tx, auth, 'supplier.update', 'supplier', id, before, after); return after; })); }

  async listSupplierProducts(auth: AccessTokenPayload, supplierId: string) {
    await this.supplier(auth.companyId, supplierId);
    const links = await this.prisma.supplierProduct.findMany({ where: { companyId: auth.companyId, supplierId }, orderBy: { supplierDescription: 'asc' } });
    const products = await this.prisma.product.findMany({ where: { companyId: auth.companyId, deletedAt: null, id: { in: links.map(({ productId }) => productId) } }, select: { id: true, code: true, description: true, active: true } });
    return links.map((link) => ({ ...link, product: products.find(({ id }) => id === link.productId) }));
  }

  async searchSupplierProducts(auth: AccessTokenPayload, query: unknown) {
    const { search } = supplierProductSearchSchema.parse(query);
    return this.prisma.product.findMany({ where: { companyId: auth.companyId, deletedAt: null, active: true, ...(search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }, { barcode: { contains: search } }] } : {}) }, orderBy: { description: 'asc' }, take: 50, select: { id: true, code: true, description: true } });
  }

  async replaceSupplierProducts(auth: AccessTokenPayload, supplierId: string, input: unknown) {
    const { products } = supplierProductsSchema.parse(input); await this.supplier(auth.companyId, supplierId);
    const validProducts = await this.prisma.product.findMany({ where: { companyId: auth.companyId, deletedAt: null, id: { in: products.map(({ productId }) => productId) } }, select: { id: true } });
    if (validProducts.length !== products.length) throw new NotFoundException('Um ou mais produtos não pertencem à empresa');
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.supplierProduct.findMany({ where: { companyId: auth.companyId, supplierId } }); const desiredIds = products.map(({ productId }) => productId); const now = new Date();
      await tx.supplierProduct.deleteMany({ where: { companyId: auth.companyId, supplierId, ...(desiredIds.length ? { productId: { notIn: desiredIds } } : {}) } });
      for (const product of products) await tx.supplierProduct.upsert({ where: { supplierId_productId: { supplierId, productId: product.productId } }, update: { supplierCode: product.supplierCode, supplierDescription: product.supplierDescription, updatedAt: now }, create: { id: uuidV7(), companyId: auth.companyId, supplierId, ...product, createdAt: now, updatedAt: now } });
      const after = await tx.supplierProduct.findMany({ where: { companyId: auth.companyId, supplierId } }); await this.audit(tx, auth, 'supplier.products.replace', 'supplier', supplierId, before, after); return after;
    });
  }

  async compareSupplierPrices(auth: AccessTokenPayload, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, companyId: auth.companyId, deletedAt: null }, select: { id: true, code: true, description: true } }); if (!product) throw new NotFoundException('Produto não encontrado');
    const links = await this.prisma.supplierProduct.findMany({ where: { companyId: auth.companyId, productId } }); const suppliers = await this.prisma.supplier.findMany({ where: { companyId: auth.companyId, deletedAt: null, id: { in: links.map(({ supplierId }) => supplierId) } }, select: { id: true, legalName: true, tradeName: true, averageLeadDays: true, active: true } });
    const offers = links.map((link) => ({ supplier: suppliers.find(({ id }) => id === link.supplierId), supplierCode: link.supplierCode, supplierDescription: link.supplierDescription, lastPrice: link.lastPrice, hasRecordedPrice: link.lastPrice !== null })).filter(({ supplier }) => Boolean(supplier)).sort((left, right) => left.lastPrice === null ? 1 : right.lastPrice === null ? -1 : left.lastPrice.comparedTo(right.lastPrice));
    return { product, offers, bestRecordedPrice: offers.find(({ lastPrice }) => lastPrice !== null)?.lastPrice ?? null, note: 'O último preço é atualizado por documentos de compra; ausência de preço não é estimada.' };
  }

  async listEmployees(auth: AccessTokenPayload, query: unknown) { const page = listSchema.parse(query); const where: Prisma.EmployeeWhereInput = { companyId: auth.companyId, deletedAt: null, ...(page.status === 'all' ? {} : { active: page.status === 'active' }), ...(page.search ? { OR: [{ name: { contains: page.search, mode: 'insensitive' } }, { code: { contains: page.search, mode: 'insensitive' } }, { taxId: { contains: page.search } }] } : {}) }; const [items, total] = await Promise.all([this.prisma.employee.findMany({ where, orderBy: { name: 'asc' }, skip: (page.page - 1) * page.pageSize, take: page.pageSize }), this.prisma.employee.count({ where })]); return { items, total, page: page.page, pageSize: page.pageSize }; }
  async createEmployee(auth: AccessTokenPayload, input: unknown) { const data = createEmployeeSchema.parse(input); await this.validateEmployeeTargets(auth.companyId, data.branchId, data.userId); return this.unique(async () => this.prisma.$transaction(async (tx) => { const now = new Date(); const item = await tx.employee.create({ data: { id: uuidV7(), companyId: auth.companyId, ...data, createdAt: now, updatedAt: now } }); await this.audit(tx, auth, 'employee.create', 'employee', item.id, null, item); return item; })); }
  async updateEmployee(auth: AccessTokenPayload, id: string, input: unknown) { const data = updateEmployeeSchema.parse(input); const before = await this.employee(auth.companyId, id); await this.validateEmployeeTargets(auth.companyId, data.branchId, data.userId); const update = this.defined({ ...data, updatedAt: new Date() }) as Prisma.EmployeeUncheckedUpdateInput; return this.unique(async () => this.prisma.$transaction(async (tx) => { const after = await tx.employee.update({ where: { id }, data: update }); await this.audit(tx, auth, 'employee.update', 'employee', id, before, after); return after; })); }

  private async createAddresses(tx: Prisma.TransactionClient, companyId: string, customerId: string, addresses: Array<{ type: string; isDefault: boolean; postalCode: string | null; street: string; number: string | null; complement: string | null; district: string | null; city: string; state: string; country: string }>, now: Date) { for (const data of addresses) { const { type, isDefault, ...addressData } = data; const address = await tx.address.create({ data: { id: uuidV7(), companyId, ...addressData, createdAt: now, updatedAt: now } }); await tx.customerAddress.create({ data: { id: uuidV7(), customerId, addressId: address.id, type, isDefault, createdAt: now, updatedAt: now } }); } }
  private async validateEmployeeTargets(companyId: string, branchId?: string | null, userId?: string | null) { if (branchId && !(await this.prisma.branch.findFirst({ where: { id: branchId, companyId, deletedAt: null } }))) throw new NotFoundException('Filial não encontrada na empresa'); if (userId && !(await this.prisma.companyUser.findFirst({ where: { companyId, userId } }))) throw new NotFoundException('Usuário não encontrado na empresa'); }
  private async customer(companyId: string, id: string) { const item = await this.prisma.customer.findFirst({ where: { id, companyId, deletedAt: null } }); if (!item) throw new NotFoundException('Cliente não encontrado'); return item; }
  private async supplier(companyId: string, id: string) { const item = await this.prisma.supplier.findFirst({ where: { id, companyId, deletedAt: null } }); if (!item) throw new NotFoundException('Fornecedor não encontrado'); return item; }
  private async employee(companyId: string, id: string) { const item = await this.prisma.employee.findFirst({ where: { id, companyId, deletedAt: null } }); if (!item) throw new NotFoundException('Funcionário não encontrado'); return item; }
  private async audit(tx: Prisma.TransactionClient, auth: AccessTokenPayload, action: string, entityType: string, entityId: string, before: unknown, after: unknown) { const now = new Date(); await tx.auditLog.create({ data: { id: uuidV7(), companyId: auth.companyId, branchId: auth.branchId, userId: auth.sub, action, entityType, entityId, ...(before === null ? {} : { beforeData: this.json(before) }), ...(after === null ? {} : { afterData: this.json(after) }), occurredAt: now, createdAt: now, updatedAt: now } }); }
  private json(value: unknown): Prisma.InputJsonValue { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
  private defined<T extends object>(value: T): Record<string, unknown> { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)); }
  private async unique<T>(operation: () => Promise<T>) { try { return await operation(); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('CPF, CNPJ ou código já cadastrado nesta empresa'); throw error; } }
}
