ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('trial', 'active', 'past_due', 'blocked', 'canceled')),
  ADD CONSTRAINT subscriptions_period_check CHECK (current_period_end > current_period_start);

CREATE UNIQUE INDEX subscriptions_one_current_per_company
  ON subscriptions(company_id)
  WHERE status IN ('trial', 'active', 'past_due', 'blocked');
CREATE INDEX subscriptions_company_created_idx ON subscriptions(company_id, created_at DESC);
CREATE INDEX subscription_modules_subscription_idx ON subscription_modules(subscription_id);

INSERT INTO saas_plans (id, code, name, price, billing_period, user_limit, branch_limit, active, created_at, updated_at)
VALUES ('01992f10-0000-7000-8000-000000000001', 'starter', 'Starter', 0, 'monthly', 5, 2, true, now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO saas_modules (id, code, name, active, created_at, updated_at) VALUES
  ('01992f10-0000-7000-8000-000000000101', 'core', 'Núcleo administrativo', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000102', 'catalog', 'Catálogo e produtos', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000103', 'stock', 'Estoque', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000104', 'sales', 'Vendas', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000105', 'purchases', 'Compras', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000106', 'finance', 'Financeiro', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000107', 'fiscal', 'Fiscal', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000108', 'food', 'Food service', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000109', 'production', 'Produção', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000110', 'services', 'Serviços', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000111', 'logistics', 'Logística', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000112', 'crm', 'CRM e fidelidade', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000113', 'integrations', 'Integrações', true, now(), now()),
  ('01992f10-0000-7000-8000-000000000114', 'analytics', 'Indicadores e BI', true, now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO plan_modules (id, plan_id, module_id, created_at, updated_at) VALUES
  ('01992f10-0000-7000-8000-000000000201', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000101', now(), now()),
  ('01992f10-0000-7000-8000-000000000202', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000102', now(), now()),
  ('01992f10-0000-7000-8000-000000000203', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000103', now(), now()),
  ('01992f10-0000-7000-8000-000000000204', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000104', now(), now())
ON CONFLICT (plan_id, module_id) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
VALUES ('01992f10-0000-7000-8000-000000000301', 'admin.subscription.read', 'admin.subscription', 'read', now(), now())
ON CONFLICT (code) DO NOTHING;
