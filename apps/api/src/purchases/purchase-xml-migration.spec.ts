import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('purchase XML migration', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260826090000_purchase_xml_import', 'migration.sql'), 'utf8');
  it('adds tenant indexes, DE-PARA uniqueness and XML permissions', () => {
    expect(migration).toContain('import_jobs(company_id, branch_id, status');
    expect(migration).toContain('supplier_products(company_id, supplier_id, supplier_code)');
    expect(migration).toContain('WHERE supplier_code IS NOT NULL');
    for (const code of ['purchases.xml.read', 'purchases.xml.import']) expect(migration).toContain(`'${code}'`);
    expect(migration).toContain("WHERE r.code = 'owner'");
  });
});
