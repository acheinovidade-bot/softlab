import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('fiscal POS terminal migration', () => {
  it('separates terminals and online/offline series by branch', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'prisma/migrations/20260831153000_fiscal_pos_terminals/migration.sql'),
      'utf8',
    );
    expect(sql).toContain('CREATE TABLE fiscal_pos_terminals');
    expect(sql).toContain('online_series');
    expect(sql).toContain('offline_series');
    expect(sql).toContain('pos_terminal_id');
  });
});
