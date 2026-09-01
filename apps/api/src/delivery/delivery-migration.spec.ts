import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('delivery kanban migration', () => {
  it('adds tenant constraints, operational indexes, and permissions', () => {
    const migration = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260826210000_delivery_kanban/migration.sql'),
      'utf8',
    );
    expect(migration).toContain('delivery_zones_company_branch_name_key');
    expect(migration).toContain('deliveries_company_order_key');
    expect(migration).toContain('deliveries_branch_status_promised_idx');
    expect(migration).toContain("'logistics.deliveries.read'");
    expect(migration).toContain("'logistics.deliveries.operate'");
    expect(migration).toContain("'logistics.settings.manage'");
  });
});
