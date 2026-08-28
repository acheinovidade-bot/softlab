import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('WhatsApp gateway migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'prisma/migrations/20260826120000_whatsapp_gateway/migration.sql'),
    'utf8',
  );
  it('scopes records by tenant and installs granular permissions', () => {
    expect(sql).toContain('FOREIGN KEY (integration_id, company_id)');
    expect(sql).toContain("'integrations.whatsapp.send'");
    expect(sql).not.toContain('access_token');
  });
});
