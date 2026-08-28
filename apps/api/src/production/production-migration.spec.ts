import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('production operations migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826130000_production_operations/migration.sql'),
    'utf8',
  );
  it('adds loss tracking, workflow integrity, indexes and permissions', () => {
    expect(sql).toContain('loss_quantity numeric(19,6)');
    expect(sql).toContain("'planned', 'separation', 'processing', 'quality', 'finalized'");
    expect(sql).toContain('production_orders_company_branch_status_idx');
    expect(sql).toContain("'production.orders.finalize'");
  });
});
