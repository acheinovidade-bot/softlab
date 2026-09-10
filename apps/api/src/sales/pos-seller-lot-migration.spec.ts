import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('POS seller and lot selection migration', () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260829090000_pos_seller_and_lot_selection',
      'migration.sql',
    ),
    'utf8',
  );
  it('adds constrained seller modes and manual lot selection', () => {
    expect(migration).toContain('seller_mode');
    expect(migration).toContain("'per_sale'");
    expect(migration).toContain('select_lot_at_pos');
    expect(migration).toContain('products_pos_lot_requires_lot_check');
  });
});
