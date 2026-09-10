ALTER TABLE delivery_zones
  ADD CONSTRAINT delivery_zones_company_branch_name_key UNIQUE(company_id, branch_id, name);

ALTER TABLE deliveries
  ADD CONSTRAINT deliveries_company_order_key UNIQUE(company_id, order_id);

CREATE INDEX drivers_company_active_name_idx ON drivers(company_id, active, name);
CREATE INDEX delivery_zones_branch_active_idx ON delivery_zones(company_id, branch_id, active);
CREATE INDEX deliveries_branch_status_promised_idx ON deliveries(company_id, branch_id, status, promised_at);
CREATE INDEX deliveries_driver_status_idx ON deliveries(company_id, driver_id, status);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992ff2-0000-7000-8000-000000000001', 'logistics.deliveries.read', 'logistics.deliveries', 'read', now(), now()),
  ('01992ff2-0000-7000-8000-000000000002', 'logistics.deliveries.operate', 'logistics.deliveries', 'operate', now(), now()),
  ('01992ff2-0000-7000-8000-000000000003', 'logistics.settings.manage', 'logistics.settings', 'manage', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code IN ('logistics.deliveries.read', 'logistics.deliveries.operate', 'logistics.settings.manage')
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

