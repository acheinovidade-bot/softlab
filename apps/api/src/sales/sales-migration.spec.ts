import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('sales workflow migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826140000_sales_workflow/migration.sql'),
    'utf8',
  );
  it('creates quote items, controlled statuses, trace fields and permissions', () => {
    expect(sql).toContain('CREATE TABLE sales_quote_items');
    expect(sql).toContain(
      "'pending', 'separation', 'invoicing', 'delivery', 'completed', 'canceled'",
    );
    expect(sql).toContain('ADD COLUMN lot_id uuid');
    expect(sql).toContain("'sales.discounts.apply'");
    expect(sql).toContain("('PIX', 'PIX', 'pix')");
  });
});
