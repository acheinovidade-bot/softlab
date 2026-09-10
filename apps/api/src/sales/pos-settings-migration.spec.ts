import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('POS branch settings migration', () => {
  it('persists defaults per company and branch and creates the management permission', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260828230000_pos_branch_settings/migration.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE pos_settings');
    expect(sql).toContain('UNIQUE (company_id, branch_id)');
    expect(sql).toContain("'sales.pos.settings.manage'");
  });
});
