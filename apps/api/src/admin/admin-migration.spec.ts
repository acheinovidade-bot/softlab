import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin permission migration', () => {
  it('seeds every permission required by the administration module', () => {
    const migration = readFileSync(
      join(process.cwd(), 'prisma', 'migrations', '20260826030000_admin_permissions', 'migration.sql'),
      'utf8',
    );

    for (const permission of [
      'admin.branches.read',
      'admin.branches.manage',
      'admin.users.read',
      'admin.users.manage',
      'admin.roles.read',
      'admin.roles.manage',
      'admin.audit.read',
    ]) {
      expect(migration).toContain(`'${permission}'`);
    }
    expect(migration).toContain('ON CONFLICT (code) DO NOTHING');
  });
});
