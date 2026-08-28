ALTER TABLE accounts_receivable
  ADD CONSTRAINT accounts_receivable_status_check CHECK (status IN ('open', 'partial', 'paid', 'canceled'));

ALTER TABLE financial_settlements
  ADD COLUMN payment_method_id uuid,
  ADD COLUMN received_by uuid,
  ADD CONSTRAINT financial_settlements_payment_method_fk FOREIGN KEY (payment_method_id, company_id) REFERENCES payment_methods(id, company_id),
  ADD CONSTRAINT financial_settlements_received_by_fk FOREIGN KEY (received_by) REFERENCES users(id);

CREATE INDEX accounts_receivable_customer_due_idx ON accounts_receivable(company_id, customer_id, status, due_date);
CREATE INDEX financial_settlements_receivable_idx ON financial_settlements(company_id, receivable_id, settled_at DESC);

INSERT INTO payment_methods (id, company_id, code, name, type, active, created_at, updated_at)
SELECT gen_random_uuid(), c.id, 'CREDIARIO', 'Crediário', 'credit_account', true, now(), now()
FROM companies c
ON CONFLICT (company_id, code) DO UPDATE SET active = true, name = EXCLUDED.name, type = EXCLUDED.type, updated_at = now();

INSERT INTO chart_accounts (id, company_id, parent_id, code, name, nature, active, created_at, updated_at)
SELECT gen_random_uuid(), c.id, NULL, '1.1.03', 'Clientes - crediário', 'D', true, now(), now()
FROM companies c
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992fd0-0000-7000-8000-000000000001', 'sales.credit.read', 'sales.credit', 'read', now(), now()),
  ('01992fd0-0000-7000-8000-000000000002', 'sales.credit.receive', 'sales.credit', 'receive', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'sales.credit.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
