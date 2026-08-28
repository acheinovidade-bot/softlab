ALTER TABLE fiscal_documents
  ADD COLUMN qr_code_url text,
  ADD COLUMN danfe_payload jsonb;

CREATE INDEX fiscal_documents_sale_status_idx ON fiscal_documents(company_id, branch_id, sale_id, status);
CREATE INDEX fiscal_settings_branch_valid_idx ON fiscal_settings(company_id, branch_id, valid_from DESC);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992ff0-0000-7000-8000-000000000001', 'fiscal.nfce.issue', 'fiscal.nfce', 'issue', now(), now()),
  ('01992ff0-0000-7000-8000-000000000002', 'sales.receipts.print', 'sales.receipts', 'print', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code IN ('fiscal.nfce.issue', 'sales.receipts.print')
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
