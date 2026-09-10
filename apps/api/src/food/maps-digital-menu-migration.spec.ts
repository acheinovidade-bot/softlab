import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('maps and digital menu migration', () => {
  it('adds validated coordinates and a private token per table', () => {
    const sql = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260828210000_maps_and_digital_menu/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('addresses_coordinates_check');
    expect(sql).toContain('food_tables_public_token_key');
    expect(sql).toContain('ALTER COLUMN created_by DROP NOT NULL');
  });
});
