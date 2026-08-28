import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('customer credit migration', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260826170000_customer_credit_statement/migration.sql',
    ),
    'utf8',
  );
  it('seeds credit account payments and protects settlement access', () => {
    expect(sql).toContain("'CREDIARIO', 'Crediário', 'credit_account'");
    expect(sql).toContain('accounts_receivable_customer_due_idx');
    expect(sql).toContain("'sales.credit.read'");
    expect(sql).toContain("'sales.credit.receive'");
  });
});
