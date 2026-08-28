import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('supplier catalog migration', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260826070000_supplier_catalog', 'migration.sql'), 'utf8');
  it('indexes supplier catalogs and price comparisons by tenant', () => {
    expect(migration).toContain('supplier_products(company_id, supplier_id)');
    expect(migration).toContain('supplier_products(company_id, product_id, last_price)');
    expect(migration).toContain('WHERE last_price IS NOT NULL');
  });
});
