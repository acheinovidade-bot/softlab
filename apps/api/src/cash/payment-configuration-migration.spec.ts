import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('payment configuration migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../prisma/migrations/20260828170000_payment_configuration/migration.sql'),
    'utf8',
  );

  it('persists card fees and net settlement values', () => {
    expect(sql).toContain('CREATE TABLE card_operators');
    expect(sql).toContain('ADD COLUMN fee_amount');
    expect(sql).toContain('ADD COLUMN net_amount');
    expect(sql).toContain('payment_methods_card_operator_fk');
  });
});
