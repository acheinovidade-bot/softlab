CREATE INDEX customers_company_name_idx ON customers(company_id, legal_name) WHERE deleted_at IS NULL;
CREATE INDEX suppliers_company_name_idx ON suppliers(company_id, legal_name) WHERE deleted_at IS NULL;
CREATE INDEX employees_company_name_idx ON employees(company_id, name) WHERE deleted_at IS NULL;
CREATE INDEX customer_addresses_customer_idx ON customer_addresses(customer_id);

INSERT INTO plan_modules (id, plan_id, module_id, created_at, updated_at)
VALUES ('01992f20-0000-7000-8000-000000000010', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000105', now(), now())
ON CONFLICT (plan_id, module_id) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f20-0000-7000-8000-000000000001', 'master.customers.read', 'master.customers', 'read', now(), now()),
  ('01992f20-0000-7000-8000-000000000002', 'master.customers.manage', 'master.customers', 'manage', now(), now()),
  ('01992f20-0000-7000-8000-000000000003', 'master.suppliers.read', 'master.suppliers', 'read', now(), now()),
  ('01992f20-0000-7000-8000-000000000004', 'master.suppliers.manage', 'master.suppliers', 'manage', now(), now()),
  ('01992f20-0000-7000-8000-000000000005', 'master.employees.read', 'master.employees', 'read', now(), now()),
  ('01992f20-0000-7000-8000-000000000006', 'master.employees.manage', 'master.employees', 'manage', now(), now())
ON CONFLICT (code) DO NOTHING;
