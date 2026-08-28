import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('purchase intelligence migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260826100000_purchase_intelligence',
      'migration.sql',
    ),
    'utf8',
  );

  it('adds analytical indexes, permissions and owner grants', () => {
    for (const index of [
      'purchase_suggestions(company_id, branch_id, calculated_at DESC)',
      'sale_items(company_id, product_id)',
      'purchase_order_items(company_id, product_id)',
    ])
      expect(migration).toContain(index);
    for (const code of ['purchases.suggestions.read', 'purchases.suggestions.calculate'])
      expect(migration).toContain(`'${code}'`);
    expect(migration).toContain("WHERE r.code = 'owner'");
  });
});
