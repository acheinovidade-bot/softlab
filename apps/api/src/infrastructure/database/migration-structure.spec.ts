import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260826010000_initial_erp_schema/migration.sql',
);
const migration = readFileSync(migrationPath, 'utf8').toLowerCase();

const requiredTables = [
  'companies',
  'branches',
  'users',
  'roles',
  'permissions',
  'employees',
  'customers',
  'suppliers',
  'products',
  'product_categories',
  'brands',
  'units',
  'stock_lots',
  'stock_balances',
  'stock_movements',
  'purchase_orders',
  'purchase_order_items',
  'quotations',
  'quotation_suppliers',
  'quotation_items',
  'orders',
  'order_items',
  'sales',
  'sale_items',
  'payments',
  'cash_registers',
  'cash_movements',
  'accounts_payable',
  'accounts_receivable',
  'bank_accounts',
  'chart_accounts',
  'cost_centers',
  'bom_headers',
  'bom_items',
  'production_orders',
  'production_consumptions',
  'production_outputs',
  'services',
  'service_orders',
  'service_order_items',
  'restaurant_tables',
  'tabs',
  'deliveries',
  'routes',
  'drivers',
  'vehicles',
  'promotions',
  'vouchers',
  'loyalty_transactions',
  'tax_rules',
  'fiscal_documents',
  'audit_logs',
  'notifications',
  'integrations',
  'webhook_endpoints',
  'saas_plans',
  'subscriptions',
  'subscription_modules',
] as const;

describe('initial relational migration', () => {
  it.each(requiredTables)('creates required table %s', (table) => {
    expect(migration).toContain(`create table ${table} (`);
  });

  it('enforces tenant foreign keys with composite references', () => {
    const tenantReferences = migration.match(/references branches\(id,company_id\)/g) ?? [];
    expect(tenantReferences.length).toBeGreaterThanOrEqual(10);
    expect(migration).toContain('references products(id,company_id)');
    expect(migration).toContain('references orders(id,company_id)');
  });

  it('protects immutable ledgers', () => {
    expect(migration).toContain('stock_movements_immutable');
    expect(migration).toContain('audit_logs_immutable');
    expect(migration).toContain('loyalty_transactions_immutable');
  });

  it('contains no database-side uuid default that would bypass UUIDv7 generation', () => {
    expect(migration).not.toMatch(/id uuid[^,]*default/i);
  });

  it('keeps the complete cross-domain model in the initial baseline', () => {
    const tables = migration.match(/^create table /gm) ?? [];
    const foreignKeys = migration.match(/foreign key/g) ?? [];
    expect(tables.length).toBeGreaterThanOrEqual(100);
    expect(foreignKeys.length).toBeGreaterThanOrEqual(80);
    expect(migration).toContain('create table stock_transfers (');
    expect(migration).toContain('create table purchase_suggestions (');
    expect(migration).toContain('create table fiscal_settings (');
    expect(migration).toContain('create table import_jobs (');
  });
});
