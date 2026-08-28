import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
describe('food migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826180000_food_service/migration.sql'),
    'utf8',
  );
  it('creates tables, multiple tabs and native channels', () => {
    expect(sql).toContain('CREATE TABLE food_tables');
    expect(sql).toContain('CREATE TABLE food_tabs');
    expect(sql).toContain("'table', 'delivery', 'counter', 'pickup', 'kiosk', 'digital_menu'");
    expect(sql).toContain("'food.tabs.operate'");
  });
});
