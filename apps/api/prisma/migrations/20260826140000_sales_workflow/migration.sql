CREATE UNIQUE INDEX employees_id_company_uq ON employees(id, company_id);

ALTER TABLE sales_quotes
  ADD COLUMN seller_id uuid,
  ADD COLUMN payment_method_id uuid,
  ADD COLUMN subtotal numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN discount numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN surcharge numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN freight numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN notes text,
  ADD CONSTRAINT sales_quotes_seller_company_fk FOREIGN KEY (seller_id, company_id) REFERENCES employees(id, company_id),
  ADD CONSTRAINT sales_quotes_payment_method_fk FOREIGN KEY (payment_method_id, company_id) REFERENCES payment_methods(id, company_id),
  ADD CONSTRAINT sales_quotes_status_check CHECK (status IN ('draft', 'sent', 'approved', 'converted', 'expired', 'canceled'));

UPDATE sales_quotes SET subtotal = total;

ALTER TABLE sales_quotes
  ADD CONSTRAINT sales_quotes_amounts_check CHECK (subtotal >= 0 AND discount >= 0 AND surcharge >= 0 AND freight >= 0 AND total = subtotal - discount + surcharge + freight);

CREATE TABLE sales_quote_items (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  sales_quote_id uuid NOT NULL,
  product_id uuid NOT NULL,
  description varchar(240) NOT NULL,
  quantity numeric(19,6) NOT NULL CHECK (quantity > 0),
  unit_price numeric(19,4) NOT NULL CHECK (unit_price >= 0),
  discount numeric(19,4) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total numeric(19,4) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sales_quote_id, product_id),
  FOREIGN KEY (sales_quote_id, company_id) REFERENCES sales_quotes(id, company_id),
  FOREIGN KEY (product_id, company_id) REFERENCES products(id, company_id)
);

ALTER TABLE orders
  ADD COLUMN seller_id uuid,
  ADD COLUMN payment_method_id uuid,
  ADD CONSTRAINT orders_seller_fk FOREIGN KEY (seller_id, company_id) REFERENCES employees(id, company_id),
  ADD CONSTRAINT orders_payment_method_fk FOREIGN KEY (payment_method_id, company_id) REFERENCES payment_methods(id, company_id),
  ADD CONSTRAINT orders_status_check CHECK (status IN ('pending', 'separation', 'invoicing', 'delivery', 'completed', 'canceled')),
  ADD CONSTRAINT orders_amounts_check CHECK (total = subtotal - discount + surcharge + freight);

ALTER TABLE order_items
  ADD COLUMN location_id uuid,
  ADD COLUMN lot_id uuid,
  ADD CONSTRAINT order_items_location_fk FOREIGN KEY (location_id, company_id) REFERENCES stock_locations(id, company_id),
  ADD CONSTRAINT order_items_lot_fk FOREIGN KEY (lot_id, company_id) REFERENCES stock_lots(id, company_id);

CREATE INDEX sales_quotes_company_branch_status_idx ON sales_quotes(company_id, branch_id, status, created_at DESC);
CREATE INDEX sales_quote_items_company_quote_idx ON sales_quote_items(company_id, sales_quote_id);
CREATE INDEX orders_company_branch_status_idx ON orders(company_id, branch_id, status, created_at DESC);
CREATE INDEX order_items_company_order_idx ON order_items(company_id, order_id);
CREATE INDEX payments_company_branch_status_idx ON payments(company_id, branch_id, status, created_at DESC);

INSERT INTO payment_methods (id, company_id, code, name, type, active, created_at, updated_at)
SELECT gen_random_uuid(), c.id, method.code, method.name, method.type, true, now(), now()
FROM companies c
CROSS JOIN (VALUES
  ('DINHEIRO', 'Dinheiro', 'cash'),
  ('PIX', 'PIX', 'pix'),
  ('DEBITO', 'Cartão de débito', 'debit_card'),
  ('CREDITO', 'Cartão de crédito', 'credit_card')
) AS method(code, name, type)
ON CONFLICT (company_id, code) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992fa0-0000-7000-8000-000000000001', 'sales.quotes.read', 'sales.quotes', 'read', now(), now()),
  ('01992fa0-0000-7000-8000-000000000002', 'sales.quotes.manage', 'sales.quotes', 'manage', now(), now()),
  ('01992fa0-0000-7000-8000-000000000003', 'sales.orders.read', 'sales.orders', 'read', now(), now()),
  ('01992fa0-0000-7000-8000-000000000004', 'sales.orders.manage', 'sales.orders', 'manage', now(), now()),
  ('01992fa0-0000-7000-8000-000000000005', 'sales.discounts.apply', 'sales.discounts', 'apply', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'sales.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
