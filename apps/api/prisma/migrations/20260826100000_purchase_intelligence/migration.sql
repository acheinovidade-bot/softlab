CREATE INDEX purchase_suggestions_company_branch_calculated_idx
  ON purchase_suggestions(company_id, branch_id, calculated_at DESC);

CREATE INDEX purchase_suggestion_items_company_product_idx
  ON purchase_suggestion_items(company_id, product_id);

CREATE INDEX sale_items_company_product_idx
  ON sale_items(company_id, product_id);

CREATE INDEX purchase_order_items_company_product_idx
  ON purchase_order_items(company_id, product_id);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f60-0000-7000-8000-000000000001', 'purchases.suggestions.read', 'purchases.suggestions', 'read', now(), now()),
  ('01992f60-0000-7000-8000-000000000002', 'purchases.suggestions.calculate', 'purchases.suggestions', 'calculate', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r
JOIN permissions p ON p.code IN ('purchases.suggestions.read', 'purchases.suggestions.calculate')
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
