import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('cash migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826160000_cash_management/migration.sql'),
    'utf8',
  );
  it('adds exclusive sessions, closing counts and permissions', () => {
    expect(sql).toContain('cash_sessions_one_open_register_idx');
    expect(sql).toContain('CREATE TABLE cash_closing_counts');
    expect(sql).toContain("'finance.cash.operate'");
    expect(sql).toContain("'finance.cash.reopen'");
  });
});
