CREATE TABLE food_tables (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL,
  code varchar(30) NOT NULL, name varchar(80) NOT NULL, capacity integer NOT NULL CHECK(capacity > 0),
  status varchar(20) NOT NULL CHECK(status IN ('free', 'occupied', 'reserved', 'inactive')),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, branch_id, code), UNIQUE(id, company_id), FOREIGN KEY(branch_id, company_id) REFERENCES branches(id, company_id)
);
CREATE INDEX food_tables_branch_status_idx ON food_tables(company_id, branch_id, status);

CREATE TABLE food_tabs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, table_id uuid,
  customer_id uuid, waiter_id uuid, number varchar(40) NOT NULL,
  channel varchar(30) NOT NULL CHECK(channel IN ('table', 'delivery', 'counter', 'pickup', 'kiosk', 'digital_menu')),
  status varchar(20) NOT NULL CHECK(status IN ('open', 'closed', 'canceled')), guests integer NOT NULL DEFAULT 1 CHECK(guests > 0),
  notes text, opened_at timestamptz NOT NULL, closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, branch_id, number), UNIQUE(id, company_id),
  FOREIGN KEY(branch_id, company_id) REFERENCES branches(id, company_id), FOREIGN KEY(table_id, company_id) REFERENCES food_tables(id, company_id),
  FOREIGN KEY(customer_id, company_id) REFERENCES customers(id, company_id), FOREIGN KEY(waiter_id, company_id) REFERENCES employees(id, company_id)
);
CREATE INDEX food_tabs_branch_status_idx ON food_tabs(company_id, branch_id, status, opened_at DESC);
CREATE INDEX food_tabs_table_status_idx ON food_tabs(company_id, table_id, status);

CREATE TABLE food_tab_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), tab_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0),
  notes text, status varchar(20) NOT NULL CHECK(status IN ('ordered', 'preparing', 'ready', 'served', 'canceled')),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(tab_id, company_id) REFERENCES food_tabs(id, company_id), FOREIGN KEY(product_id, company_id) REFERENCES products(id, company_id)
);
CREATE INDEX food_tab_items_tab_idx ON food_tab_items(company_id, tab_id, created_at);

INSERT INTO food_tables (id, company_id, branch_id, code, name, capacity, status, active, created_at, updated_at)
SELECT gen_random_uuid(), b.company_id, b.id, 'M' || lpad(n::text, 2, '0'), 'Mesa ' || n, 4, 'free', true, now(), now()
FROM branches b CROSS JOIN generate_series(1, 12) AS n
ON CONFLICT (company_id, branch_id, code) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992fe0-0000-7000-8000-000000000001', 'food.tables.read', 'food.tables', 'read', now(), now()),
  ('01992fe0-0000-7000-8000-000000000002', 'food.tables.manage', 'food.tables', 'manage', now(), now()),
  ('01992fe0-0000-7000-8000-000000000003', 'food.tabs.operate', 'food.tabs', 'operate', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now() FROM roles r JOIN permissions p ON p.code LIKE 'food.%'
WHERE r.code = 'owner' ON CONFLICT (role_id, permission_id) DO NOTHING;
