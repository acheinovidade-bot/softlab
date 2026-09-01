CREATE TABLE pos_settings (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid NOT NULL,
  default_customer_id uuid REFERENCES customers(id),
  default_seller_id uuid REFERENCES employees(id),
  default_location_id uuid REFERENCES stock_locations(id),
  created_by uuid NOT NULL REFERENCES users(id),
  updated_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT pos_settings_company_branch_unique UNIQUE (company_id, branch_id),
  CONSTRAINT pos_settings_branch_company_fk FOREIGN KEY (branch_id, company_id)
    REFERENCES branches(id, company_id)
);

CREATE INDEX pos_settings_company_branch_idx ON pos_settings(company_id, branch_id);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
VALUES (
  '01993001-0000-7000-8000-000000000001',
  'sales.pos.settings.manage',
  'sales.pos.settings',
  'manage',
  now(),
  now()
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r
JOIN permissions p ON p.code = 'sales.pos.settings.manage'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
