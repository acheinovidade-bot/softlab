import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('fiscal hub migrations', () => {
  it('persists printable DANFE data and permissions', () => {
    const printing = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260826190000_nfce_printing/migration.sql'),
      'utf8',
    );
    const permissions = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260826200000_fiscal_hub_permissions/migration.sql',
      ),
      'utf8',
    );
    expect(printing).toContain('qr_code_url');
    expect(printing).toContain("'fiscal.nfce.issue'");
    expect(permissions).toContain("'fiscal.settings.manage'");
  });
});
