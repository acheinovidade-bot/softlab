import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260826020000_auth_security/migration.sql'),
  'utf8',
).toLowerCase();

describe('authentication migration', () => {
  it('binds every session to company and branch', () => {
    expect(migration).toContain('sessions_branch_company_fk');
    expect(migration).toContain('alter column company_id set not null');
    expect(migration).toContain('alter column branch_id set not null');
  });

  it('creates immutable access logs without storing the e-mail', () => {
    expect(migration).toContain('create table login_attempts (');
    expect(migration).toContain('email_hash char(64)');
    expect(migration).not.toMatch(/\bemail varchar/);
    expect(migration).toContain('login_attempts_immutable');
  });
});
