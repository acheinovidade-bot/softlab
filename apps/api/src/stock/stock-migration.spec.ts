import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('stock operations migration', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260826080000_stock_operations', 'migration.sql'), 'utf8');
  it('adds tenant indexes, permissions and default storage locations', () => {
    for (const code of ['stock.inventory.read', 'stock.movements.read', 'stock.adjustments.create']) expect(migration).toContain(`'${code}'`);
    expect(migration).toContain('stock_balances(company_id, branch_id, product_id)'); expect(migration).toContain("'PRINCIPAL'"); expect(migration).toContain("'GERAL'");
  });
});
