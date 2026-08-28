import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('POS checkout migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826150000_pos_checkout/migration.sql'),
    'utf8',
  );

  it('constrains terminal statuses and provisions POS permissions', () => {
    expect(sql).toContain("'pending', 'paid', 'canceled', 'failed', 'refunded'");
    expect(sql).toContain("'invoiced', 'completed', 'canceled'");
    expect(sql).toContain("'sales.pos.use'");
    expect(sql).toContain("'sales.pos.discount'");
    expect(sql).toContain('CREATE INDEX sales_company_branch_sold_idx');
  });
});
