ALTER TABLE payments
  ADD CONSTRAINT payments_status_check CHECK (status IN ('pending', 'paid', 'canceled', 'failed', 'refunded'));

ALTER TABLE sales
  ADD CONSTRAINT sales_status_check CHECK (status IN ('invoiced', 'completed', 'canceled'));

CREATE INDEX sales_company_branch_sold_idx ON sales(company_id, branch_id, sold_at DESC);
CREATE INDEX sale_items_company_sale_idx ON sale_items(company_id, sale_id);
CREATE INDEX sale_item_traces_company_sale_item_idx ON sale_item_traces(company_id, sale_item_id);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992fb0-0000-7000-8000-000000000001', 'sales.pos.use', 'sales.pos', 'use', now(), now()),
  ('01992fb0-0000-7000-8000-000000000002', 'sales.pos.discount', 'sales.pos', 'discount', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'sales.pos.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
