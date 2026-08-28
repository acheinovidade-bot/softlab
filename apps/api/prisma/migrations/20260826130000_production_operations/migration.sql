ALTER TABLE production_orders
  ADD COLUMN quality_notes text,
  ADD CONSTRAINT production_orders_status_check
    CHECK (status IN ('planned', 'separation', 'processing', 'quality', 'finalized')),
  ADD CONSTRAINT production_orders_produced_quantity_check
    CHECK (produced_quantity >= 0 AND produced_quantity <= planned_quantity * 10);

ALTER TABLE production_consumptions
  ADD COLUMN loss_quantity numeric(19,6) NOT NULL DEFAULT 0,
  ADD CONSTRAINT production_consumptions_loss_check CHECK (loss_quantity >= 0);

CREATE INDEX bom_headers_company_product_active_idx ON bom_headers(company_id, product_id, active);
CREATE INDEX bom_items_company_component_idx ON bom_items(company_id, component_product_id);
CREATE INDEX production_orders_company_branch_status_idx ON production_orders(company_id, branch_id, status, planned_at DESC);
CREATE INDEX production_consumptions_company_order_idx ON production_consumptions(company_id, production_order_id);
CREATE INDEX production_outputs_company_order_idx ON production_outputs(company_id, production_order_id);

INSERT INTO plan_modules (id, plan_id, module_id, created_at, updated_at)
VALUES ('01992f90-0000-7000-8000-000000000010', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000109', now(), now())
ON CONFLICT (plan_id, module_id) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f90-0000-7000-8000-000000000001', 'production.engineering.read', 'production.engineering', 'read', now(), now()),
  ('01992f90-0000-7000-8000-000000000002', 'production.engineering.manage', 'production.engineering', 'manage', now(), now()),
  ('01992f90-0000-7000-8000-000000000003', 'production.orders.read', 'production.orders', 'read', now(), now()),
  ('01992f90-0000-7000-8000-000000000004', 'production.orders.manage', 'production.orders', 'manage', now(), now()),
  ('01992f90-0000-7000-8000-000000000005', 'production.orders.finalize', 'production.orders', 'finalize', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'production.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
