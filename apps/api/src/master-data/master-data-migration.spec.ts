import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('master data migration', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260826050000_master_data', 'migration.sql'), 'utf8');
  it('adds tenant search indexes and all permissions', () => {
    for (const code of ['master.customers.read', 'master.customers.manage', 'master.suppliers.read', 'master.suppliers.manage', 'master.employees.read', 'master.employees.manage']) expect(migration).toContain(`'${code}'`);
    expect(migration).toContain('customers_company_name_idx'); expect(migration).toContain('ON CONFLICT (code) DO NOTHING');
  });
});
