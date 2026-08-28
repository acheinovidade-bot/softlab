CREATE INDEX stock_balances_company_branch_product_idx
  ON stock_balances(company_id, branch_id, product_id);

CREATE INDEX stock_locations_company_warehouse_idx
  ON stock_locations(company_id, warehouse_id);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f40-0000-7000-8000-000000000001', 'stock.inventory.read', 'stock.inventory', 'read', now(), now()),
  ('01992f40-0000-7000-8000-000000000002', 'stock.movements.read', 'stock.movements', 'read', now(), now()),
  ('01992f40-0000-7000-8000-000000000003', 'stock.adjustments.create', 'stock.adjustments', 'create', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO warehouses (id, company_id, branch_id, code, name, created_at, updated_at)
SELECT gen_random_uuid(), b.company_id, b.id, 'PRINCIPAL', 'Estoque principal', now(), now()
FROM branches b
WHERE b.deleted_at IS NULL
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO stock_locations (id, company_id, warehouse_id, code, name, created_at, updated_at)
SELECT gen_random_uuid(), w.company_id, w.id, 'GERAL', 'Localização geral', now(), now()
FROM warehouses w
WHERE w.code = 'PRINCIPAL'
  AND NOT EXISTS (SELECT 1 FROM stock_locations l WHERE l.warehouse_id = w.id AND l.code = 'GERAL');
