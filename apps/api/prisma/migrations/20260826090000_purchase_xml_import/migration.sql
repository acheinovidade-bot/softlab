CREATE INDEX import_jobs_company_branch_status_idx
  ON import_jobs(company_id, branch_id, status, created_at DESC);

CREATE INDEX supplier_invoice_items_supplier_code_idx
  ON supplier_invoice_items(company_id, supplier_code)
  WHERE supplier_code IS NOT NULL;

CREATE UNIQUE INDEX supplier_products_supplier_code_uq
  ON supplier_products(company_id, supplier_id, supplier_code)
  WHERE supplier_code IS NOT NULL;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f50-0000-7000-8000-000000000001', 'purchases.xml.read', 'purchases.xml', 'read', now(), now()),
  ('01992f50-0000-7000-8000-000000000002', 'purchases.xml.import', 'purchases.xml', 'import', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r
JOIN permissions p ON p.code IN ('purchases.xml.read', 'purchases.xml.import')
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
