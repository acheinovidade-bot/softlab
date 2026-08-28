import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('SaaS entitlement migration', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260826040000_saas_entitlements', 'migration.sql'), 'utf8');

  it('creates a single-current-subscription invariant', () => {
    expect(migration).toContain('subscriptions_one_current_per_company');
    expect(migration).toContain("status IN ('trial', 'active', 'past_due', 'blocked')");
  });

  it('seeds the starter catalog and subscription permission idempotently', () => {
    expect(migration).toContain("'starter'");
    expect(migration).toContain("'admin.subscription.read'");
    expect(migration).toContain('ON CONFLICT (code) DO NOTHING');
  });
});
