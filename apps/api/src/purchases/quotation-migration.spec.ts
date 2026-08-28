import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('smart quotation migration', () => {
  const migration = readFileSync(
    join(process.cwd(), 'prisma', 'migrations', '20260826110000_smart_quotations', 'migration.sql'),
    'utf8',
  );
  it('links suggestions, adds objective payment terms, indexes and permissions', () => {
    expect(migration).toContain('purchase_suggestion_id');
    expect(migration).toContain('payment_term_days');
    expect(migration).toContain('quotation_items_quotation_product_uq');
    for (const code of ['purchases.quotations.read', 'purchases.quotations.manage'])
      expect(migration).toContain(`'${code}'`);
    expect(migration).toContain("WHERE r.code = 'owner'");
  });
});
