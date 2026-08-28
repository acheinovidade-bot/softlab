CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE saas_plans (
  id uuid PRIMARY KEY, code varchar(50) NOT NULL UNIQUE, name varchar(120) NOT NULL,
  price numeric(19,4) NOT NULL CHECK (price >= 0), billing_period varchar(20) NOT NULL,
  user_limit integer NOT NULL CHECK (user_limit > 0), branch_limit integer NOT NULL CHECK (branch_limit > 0),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE saas_modules (
  id uuid PRIMARY KEY, code varchar(80) NOT NULL UNIQUE, name varchar(120) NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE plan_modules (
  id uuid PRIMARY KEY, plan_id uuid NOT NULL REFERENCES saas_plans(id), module_id uuid NOT NULL REFERENCES saas_modules(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(plan_id,module_id)
);
CREATE TABLE companies (
  id uuid PRIMARY KEY, legal_name varchar(200) NOT NULL, trade_name varchar(200), tax_id varchar(14) NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'active', timezone varchar(80) NOT NULL DEFAULT 'America/Fortaleza',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE branches (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(40) NOT NULL, legal_name varchar(200) NOT NULL,
  trade_name varchar(200), tax_id varchar(14) NOT NULL, status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(company_id,code), UNIQUE(company_id,tax_id), UNIQUE(id,company_id)
);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), plan_id uuid NOT NULL REFERENCES saas_plans(id),
  status varchar(20) NOT NULL, trial_ends_at timestamptz, current_period_start timestamptz NOT NULL, current_period_end timestamptz NOT NULL,
  blocked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE subscription_modules (
  id uuid PRIMARY KEY, subscription_id uuid NOT NULL REFERENCES subscriptions(id), module_id uuid NOT NULL REFERENCES saas_modules(id),
  enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id,module_id)
);
CREATE TABLE users (
  id uuid PRIMARY KEY, email varchar(254) NOT NULL UNIQUE, password_hash varchar(255) NOT NULL, display_name varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active', password_changed_at timestamptz, mfa_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz
);
CREATE TABLE company_users (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), user_id uuid NOT NULL REFERENCES users(id), status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,user_id), UNIQUE(id,company_id)
);
CREATE TABLE user_branches (
  id uuid PRIMARY KEY, company_user_id uuid NOT NULL REFERENCES company_users(id), branch_id uuid NOT NULL REFERENCES branches(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_user_id,branch_id)
);
CREATE TABLE roles (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(80) NOT NULL, name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE permissions (
  id uuid PRIMARY KEY, code varchar(120) NOT NULL UNIQUE, resource varchar(80) NOT NULL, action varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE role_permissions (
  id uuid PRIMARY KEY, role_id uuid NOT NULL REFERENCES roles(id), permission_id uuid NOT NULL REFERENCES permissions(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(role_id,permission_id)
);
CREATE TABLE user_roles (
  id uuid PRIMARY KEY, company_user_id uuid NOT NULL REFERENCES company_users(id), role_id uuid NOT NULL REFERENCES roles(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_user_id,role_id)
);
CREATE TABLE user_permissions (
  id uuid PRIMARY KEY, company_user_id uuid NOT NULL REFERENCES company_users(id), permission_id uuid NOT NULL REFERENCES permissions(id), allowed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_user_id,permission_id)
);
CREATE TABLE sessions (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), refresh_token_hash varchar(255) NOT NULL UNIQUE,
  ip inet, user_agent text, expires_at timestamptz NOT NULL, revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE password_reset_tokens (
  id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), token_hash varchar(255) NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE employees (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, user_id uuid REFERENCES users(id),
  code varchar(40) NOT NULL, name varchar(160) NOT NULL, tax_id varchar(14), job_title varchar(100), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(company_id,code), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE addresses (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), postal_code varchar(8), street varchar(180) NOT NULL, number varchar(30),
  complement varchar(120), district varchar(120), city varchar(120) NOT NULL, state char(2) NOT NULL, country char(2) NOT NULL DEFAULT 'BR',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), person_type char(1) NOT NULL CHECK(person_type IN ('F','J')),
  tax_id varchar(14), legal_name varchar(200) NOT NULL, trade_name varchar(200), phone varchar(30), whatsapp varchar(30), email varchar(254),
  credit_limit numeric(19,4) NOT NULL DEFAULT 0 CHECK(credit_limit >= 0), notes text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(company_id,tax_id), UNIQUE(id,company_id)
);
CREATE TABLE customer_addresses (
  id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES customers(id), address_id uuid NOT NULL REFERENCES addresses(id), type varchar(20) NOT NULL,
  is_default boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(customer_id,address_id,type)
);
CREATE TABLE suppliers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), tax_id varchar(14), legal_name varchar(200) NOT NULL, trade_name varchar(200),
  email varchar(254), phone varchar(30), average_lead_days integer CHECK(average_lead_days >= 0), payment_terms text, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(company_id,tax_id), UNIQUE(id,company_id)
);
CREATE TABLE product_groups (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name varchar(120) NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(company_id,name)
);
CREATE TABLE product_categories (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), parent_id uuid REFERENCES product_categories(id), name varchar(120) NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(company_id,parent_id,name)
);
CREATE TABLE brands (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name varchar(120) NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz, UNIQUE(company_id,name)
);
CREATE TABLE units (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(12) NOT NULL, name varchar(80) NOT NULL, decimal_places smallint NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code)
);
CREATE TABLE products (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(60) NOT NULL, barcode varchar(30), description varchar(240) NOT NULL,
  short_description varchar(120), group_id uuid REFERENCES product_groups(id), category_id uuid REFERENCES product_categories(id), brand_id uuid REFERENCES brands(id),
  unit_id uuid NOT NULL REFERENCES units(id), reference varchar(80), product_type varchar(20) NOT NULL DEFAULT 'resale', controls_lot boolean NOT NULL DEFAULT false,
  controls_expiry boolean NOT NULL DEFAULT false, allows_negative_stock boolean NOT NULL DEFAULT false, open_price boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  UNIQUE(company_id,code), UNIQUE(company_id,barcode), UNIQUE(id,company_id)
);
CREATE TABLE product_branch_settings (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, product_id uuid NOT NULL,
  minimum_stock numeric(19,6) NOT NULL DEFAULT 0, maximum_stock numeric(19,6), location_label varchar(100), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(branch_id,product_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE warehouses (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, code varchar(40) NOT NULL, name varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(branch_id,code), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE stock_locations (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), warehouse_id uuid NOT NULL, parent_id uuid REFERENCES stock_locations(id),
  code varchar(60) NOT NULL, name varchar(120) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id,code), UNIQUE(id,company_id), FOREIGN KEY(warehouse_id,company_id) REFERENCES warehouses(id,company_id)
);
CREATE TABLE stock_lots (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL, lot_number varchar(80) NOT NULL,
  manufactured_at date, expires_at date, source_type varchar(40), source_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,product_id,lot_number), UNIQUE(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id),
  CHECK(expires_at IS NULL OR manufactured_at IS NULL OR expires_at >= manufactured_at)
);
CREATE TABLE stock_balances (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, location_id uuid NOT NULL, product_id uuid NOT NULL,
  lot_id uuid, quantity numeric(19,6) NOT NULL DEFAULT 0, reserved_quantity numeric(19,6) NOT NULL DEFAULT 0 CHECK(reserved_quantity >= 0), version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(location_id,company_id) REFERENCES stock_locations(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE UNIQUE INDEX stock_balances_dimension_uq ON stock_balances(branch_id,location_id,product_id,COALESCE(lot_id,'00000000-0000-0000-0000-000000000000'::uuid));
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, location_id uuid NOT NULL, product_id uuid NOT NULL,
  lot_id uuid, movement_type varchar(30) NOT NULL, quantity numeric(19,6) NOT NULL CHECK(quantity <> 0), unit_cost numeric(19,4), reference_type varchar(40) NOT NULL,
  reference_id uuid NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(location_id,company_id) REFERENCES stock_locations(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);

CREATE TABLE supplier_products (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), supplier_id uuid NOT NULL, product_id uuid NOT NULL,
  supplier_code varchar(80), supplier_description varchar(240), last_price numeric(19,4),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(supplier_id,product_id),
  FOREIGN KEY(supplier_id,company_id) REFERENCES suppliers(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE purchase_orders (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, supplier_id uuid NOT NULL, number varchar(40) NOT NULL,
  status varchar(30) NOT NULL, ordered_at timestamptz NOT NULL, expected_at date, subtotal numeric(19,4) NOT NULL CHECK(subtotal >= 0),
  discount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount >= 0), freight numeric(19,4) NOT NULL DEFAULT 0 CHECK(freight >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(supplier_id,company_id) REFERENCES suppliers(id,company_id)
);
CREATE TABLE purchase_order_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), purchase_order_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), received_quantity numeric(19,6) NOT NULL DEFAULT 0 CHECK(received_quantity >= 0),
  unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0), discount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(purchase_order_id,company_id) REFERENCES purchase_orders(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE supplier_invoices (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, supplier_id uuid NOT NULL,
  access_key char(44) NOT NULL, number varchar(20) NOT NULL, series varchar(10), issued_at timestamptz NOT NULL, total numeric(19,4) NOT NULL CHECK(total >= 0),
  xml_storage_key text NOT NULL, xml_hash char(64) NOT NULL, status varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,access_key), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(supplier_id,company_id) REFERENCES suppliers(id,company_id)
);
CREATE TABLE supplier_invoice_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), supplier_invoice_id uuid NOT NULL, product_id uuid,
  supplier_code varchar(80), description varchar(240) NOT NULL, ncm varchar(8), cfop varchar(4), quantity numeric(19,6) NOT NULL CHECK(quantity > 0),
  unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0), tax_payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(supplier_invoice_id,company_id) REFERENCES supplier_invoices(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE supplier_invoice_item_traces (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), invoice_item_id uuid NOT NULL REFERENCES supplier_invoice_items(id),
  lot_id uuid, lot_number varchar(80) NOT NULL, quantity numeric(19,6) NOT NULL CHECK(quantity > 0), manufactured_at date, expires_at date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE quotations (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, number varchar(40) NOT NULL, status varchar(30) NOT NULL,
  response_deadline timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE quotation_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), quotation_id uuid NOT NULL, product_id uuid NOT NULL,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(quotation_id,company_id) REFERENCES quotations(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE quotation_suppliers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), quotation_id uuid NOT NULL, supplier_id uuid NOT NULL,
  access_token_hash varchar(255) NOT NULL UNIQUE, status varchar(30) NOT NULL, sent_at timestamptz, responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(quotation_id,supplier_id),
  FOREIGN KEY(quotation_id,company_id) REFERENCES quotations(id,company_id), FOREIGN KEY(supplier_id,company_id) REFERENCES suppliers(id,company_id)
);
CREATE TABLE quotation_response_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), quotation_supplier_id uuid NOT NULL REFERENCES quotation_suppliers(id), quotation_item_id uuid NOT NULL REFERENCES quotation_items(id),
  brand varchar(120), offered_quantity numeric(19,6) NOT NULL CHECK(offered_quantity >= 0), unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0),
  lead_days integer CHECK(lead_days >= 0), payment_terms text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quotation_supplier_id,quotation_item_id)
);
CREATE TABLE sales_quotes (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, customer_id uuid, number varchar(40) NOT NULL,
  status varchar(30) NOT NULL, valid_until date, total numeric(19,4) NOT NULL CHECK(total >= 0), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE orders (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, customer_id uuid, sales_quote_id uuid REFERENCES sales_quotes(id),
  number varchar(40) NOT NULL, origin varchar(30) NOT NULL, status varchar(30) NOT NULL, subtotal numeric(19,4) NOT NULL CHECK(subtotal >= 0),
  discount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount >= 0), surcharge numeric(19,4) NOT NULL DEFAULT 0 CHECK(surcharge >= 0),
  freight numeric(19,4) NOT NULL DEFAULT 0 CHECK(freight >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0), notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE order_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), order_id uuid NOT NULL, product_id uuid NOT NULL,
  description varchar(240) NOT NULL, quantity numeric(19,6) NOT NULL CHECK(quantity > 0), unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0),
  discount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE sales (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, order_id uuid NOT NULL,
  number varchar(40) NOT NULL, status varchar(30) NOT NULL, sold_at timestamptz NOT NULL, total numeric(19,4) NOT NULL CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,number), UNIQUE(order_id), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id)
);
CREATE TABLE sale_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), sale_id uuid NOT NULL, order_item_id uuid NOT NULL,
  product_id uuid NOT NULL, quantity numeric(19,6) NOT NULL CHECK(quantity > 0), unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0),
  total numeric(19,4) NOT NULL CHECK(total >= 0), tax_snapshot jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(sale_id,company_id) REFERENCES sales(id,company_id), FOREIGN KEY(order_item_id,company_id) REFERENCES order_items(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE sale_item_traces (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), sale_item_id uuid NOT NULL REFERENCES sale_items(id), lot_id uuid NOT NULL,
  stock_movement_id uuid NOT NULL REFERENCES stock_movements(id), quantity numeric(19,6) NOT NULL CHECK(quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE payment_methods (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(40) NOT NULL, name varchar(100) NOT NULL, type varchar(30) NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE payments (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, order_id uuid NOT NULL, payment_method_id uuid NOT NULL,
  amount numeric(19,4) NOT NULL CHECK(amount > 0), status varchar(30) NOT NULL, idempotency_key varchar(120) NOT NULL,
  paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,idempotency_key), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id), FOREIGN KEY(payment_method_id,company_id) REFERENCES payment_methods(id,company_id)
);
CREATE TABLE cash_registers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, code varchar(40) NOT NULL, name varchar(100) NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(branch_id,code), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE cash_sessions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), cash_register_id uuid NOT NULL, operator_id uuid NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL, opening_amount numeric(19,4) NOT NULL CHECK(opening_amount >= 0), opened_at timestamptz NOT NULL, closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id), FOREIGN KEY(cash_register_id,company_id) REFERENCES cash_registers(id,company_id)
);
CREATE TABLE cash_movements (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), cash_session_id uuid NOT NULL, payment_id uuid,
  type varchar(30) NOT NULL, amount numeric(19,4) NOT NULL CHECK(amount > 0), description varchar(240) NOT NULL, occurred_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(cash_session_id,company_id) REFERENCES cash_sessions(id,company_id), FOREIGN KEY(payment_id,company_id) REFERENCES payments(id,company_id)
);

CREATE TABLE chart_accounts (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), parent_id uuid REFERENCES chart_accounts(id), code varchar(40) NOT NULL,
  name varchar(160) NOT NULL, nature char(1) NOT NULL CHECK(nature IN ('D','C')), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE cost_centers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), parent_id uuid REFERENCES cost_centers(id), code varchar(40) NOT NULL, name varchar(160) NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE bank_accounts (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, bank_code varchar(8) NOT NULL, agency varchar(20), account_number varchar(40) NOT NULL,
  account_type varchar(20) NOT NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,bank_code,agency,account_number), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE accounts_payable (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, supplier_id uuid, chart_account_id uuid NOT NULL, cost_center_id uuid,
  source_type varchar(40) NOT NULL, source_id uuid, description varchar(240) NOT NULL, competence_date date NOT NULL, due_date date NOT NULL,
  amount numeric(19,4) NOT NULL CHECK(amount > 0), open_amount numeric(19,4) NOT NULL CHECK(open_amount >= 0), status varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(supplier_id,company_id) REFERENCES suppliers(id,company_id),
  FOREIGN KEY(chart_account_id,company_id) REFERENCES chart_accounts(id,company_id), FOREIGN KEY(cost_center_id,company_id) REFERENCES cost_centers(id,company_id)
);
CREATE TABLE accounts_receivable (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, customer_id uuid, order_id uuid, chart_account_id uuid NOT NULL, cost_center_id uuid,
  description varchar(240) NOT NULL, competence_date date NOT NULL, due_date date NOT NULL, amount numeric(19,4) NOT NULL CHECK(amount > 0),
  open_amount numeric(19,4) NOT NULL CHECK(open_amount >= 0), status varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id),
  FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id), FOREIGN KEY(chart_account_id,company_id) REFERENCES chart_accounts(id,company_id),
  FOREIGN KEY(cost_center_id,company_id) REFERENCES cost_centers(id,company_id)
);
CREATE TABLE financial_settlements (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), payable_id uuid, receivable_id uuid, bank_account_id uuid, cash_session_id uuid,
  principal_amount numeric(19,4) NOT NULL CHECK(principal_amount > 0), interest numeric(19,4) NOT NULL DEFAULT 0 CHECK(interest >= 0),
  discount numeric(19,4) NOT NULL DEFAULT 0 CHECK(discount >= 0), settled_at timestamptz NOT NULL, idempotency_key varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,idempotency_key),
  CHECK((payable_id IS NOT NULL)::int + (receivable_id IS NOT NULL)::int = 1),
  FOREIGN KEY(payable_id,company_id) REFERENCES accounts_payable(id,company_id), FOREIGN KEY(receivable_id,company_id) REFERENCES accounts_receivable(id,company_id),
  FOREIGN KEY(bank_account_id,company_id) REFERENCES bank_accounts(id,company_id), FOREIGN KEY(cash_session_id,company_id) REFERENCES cash_sessions(id,company_id)
);
CREATE TABLE bom_headers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL, version integer NOT NULL CHECK(version > 0),
  yield_quantity numeric(19,6) NOT NULL CHECK(yield_quantity > 0), expected_loss_percent numeric(9,4) NOT NULL DEFAULT 0 CHECK(expected_loss_percent BETWEEN 0 AND 100),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(product_id,version), UNIQUE(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE bom_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), bom_id uuid NOT NULL, component_product_id uuid NOT NULL, unit_id uuid NOT NULL REFERENCES units(id),
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), loss_percent numeric(9,4) NOT NULL DEFAULT 0 CHECK(loss_percent BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(bom_id,component_product_id),
  FOREIGN KEY(bom_id,company_id) REFERENCES bom_headers(id,company_id), FOREIGN KEY(component_product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE production_orders (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, bom_id uuid NOT NULL, product_id uuid NOT NULL,
  number varchar(40) NOT NULL, status varchar(30) NOT NULL, planned_quantity numeric(19,6) NOT NULL CHECK(planned_quantity > 0), produced_quantity numeric(19,6) NOT NULL DEFAULT 0,
  planned_at timestamptz NOT NULL, started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id),
  FOREIGN KEY(bom_id,company_id) REFERENCES bom_headers(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE production_consumptions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), production_order_id uuid NOT NULL, product_id uuid NOT NULL, lot_id uuid,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), stock_movement_id uuid NOT NULL REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(production_order_id,company_id) REFERENCES production_orders(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE production_outputs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), production_order_id uuid NOT NULL, product_id uuid NOT NULL, lot_id uuid NOT NULL,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), stock_movement_id uuid NOT NULL REFERENCES stock_movements(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(production_order_id,company_id) REFERENCES production_orders(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE tax_rules (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name varchar(160) NOT NULL, tax_regime varchar(30) NOT NULL,
  operation_type varchar(40) NOT NULL, origin_state char(2), destination_state char(2), ncm varchar(8), cfop varchar(4), priority integer NOT NULL DEFAULT 0,
  rule_payload jsonb NOT NULL, valid_from date NOT NULL, valid_until date, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(valid_until IS NULL OR valid_until >= valid_from), UNIQUE(id,company_id)
);
CREATE TABLE fiscal_documents (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, sale_id uuid, supplier_invoice_id uuid,
  document_type varchar(10) NOT NULL, model varchar(4), series varchar(10), number bigint, access_key char(44), status varchar(30) NOT NULL,
  issued_at timestamptz, total numeric(19,4) NOT NULL CHECK(total >= 0), xml_storage_key text, protocol varchar(60),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,access_key), UNIQUE(company_id,branch_id,document_type,series,number), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(sale_id,company_id) REFERENCES sales(id,company_id),
  FOREIGN KEY(supplier_invoice_id,company_id) REFERENCES supplier_invoices(id,company_id)
);
CREATE TABLE fiscal_document_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), fiscal_document_id uuid NOT NULL, product_id uuid, sale_item_id uuid REFERENCES sale_items(id),
  sequence integer NOT NULL CHECK(sequence > 0), description varchar(240) NOT NULL, ncm varchar(8), cest varchar(7), cfop varchar(4), cst_csosn varchar(4),
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0), taxes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(fiscal_document_id,sequence),
  FOREIGN KEY(fiscal_document_id,company_id) REFERENCES fiscal_documents(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);
CREATE TABLE fiscal_document_events (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), fiscal_document_id uuid NOT NULL, event_type varchar(40) NOT NULL,
  sequence integer NOT NULL, status varchar(30) NOT NULL, protocol varchar(60), payload jsonb NOT NULL, occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(fiscal_document_id,event_type,sequence),
  FOREIGN KEY(fiscal_document_id,company_id) REFERENCES fiscal_documents(id,company_id)
);
CREATE TABLE services (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(40) NOT NULL, name varchar(160) NOT NULL, price numeric(19,4) NOT NULL CHECK(price >= 0),
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE service_orders (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, customer_id uuid NOT NULL, technician_id uuid REFERENCES employees(id),
  number varchar(40) NOT NULL, status varchar(30) NOT NULL, equipment_description varchar(240), brand varchar(100), model varchar(100), serial_number varchar(100),
  reported_defect text NOT NULL, diagnosis text, warranty_until date, total numeric(19,4) NOT NULL DEFAULT 0 CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE service_order_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), service_order_id uuid NOT NULL, service_id uuid, product_id uuid,
  item_type varchar(10) NOT NULL CHECK(item_type IN ('service','part')), description varchar(240) NOT NULL, quantity numeric(19,6) NOT NULL CHECK(quantity > 0),
  unit_price numeric(19,4) NOT NULL CHECK(unit_price >= 0), total numeric(19,4) NOT NULL CHECK(total >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK((service_id IS NOT NULL)::int + (product_id IS NOT NULL)::int = 1),
  FOREIGN KEY(service_order_id,company_id) REFERENCES service_orders(id,company_id), FOREIGN KEY(service_id,company_id) REFERENCES services(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id)
);

CREATE TABLE restaurant_tables (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, code varchar(40) NOT NULL, seats integer CHECK(seats > 0), status varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(branch_id,code), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE tabs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, customer_id uuid, number varchar(40) NOT NULL, status varchar(20) NOT NULL,
  opened_at timestamptz NOT NULL, closed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id,branch_id,number), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE table_tabs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), table_id uuid NOT NULL, tab_id uuid NOT NULL,
  linked_at timestamptz NOT NULL, unlinked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(table_id,company_id) REFERENCES restaurant_tables(id,company_id), FOREIGN KEY(tab_id,company_id) REFERENCES tabs(id,company_id)
);
CREATE TABLE order_tabs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), order_id uuid NOT NULL, tab_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,tab_id),
  FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id), FOREIGN KEY(tab_id,company_id) REFERENCES tabs(id,company_id)
);
CREATE TABLE drivers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), employee_id uuid REFERENCES employees(id), name varchar(160) NOT NULL,
  phone varchar(30), active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id)
);
CREATE TABLE vehicles (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, plate varchar(10) NOT NULL, description varchar(160) NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,plate), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE routes (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, driver_id uuid, vehicle_id uuid,
  status varchar(20) NOT NULL, planned_at timestamptz NOT NULL, started_at timestamptz, finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(driver_id,company_id) REFERENCES drivers(id,company_id), FOREIGN KEY(vehicle_id,company_id) REFERENCES vehicles(id,company_id)
);
CREATE TABLE deliveries (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, order_id uuid NOT NULL, route_id uuid, driver_id uuid,
  address_id uuid NOT NULL REFERENCES addresses(id), status varchar(30) NOT NULL, fee numeric(19,4) NOT NULL DEFAULT 0 CHECK(fee >= 0),
  distance_km numeric(12,4) CHECK(distance_km >= 0), promised_at timestamptz, delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id),
  FOREIGN KEY(route_id,company_id) REFERENCES routes(id,company_id), FOREIGN KEY(driver_id,company_id) REFERENCES drivers(id,company_id)
);
CREATE TABLE promotions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), name varchar(160) NOT NULL, promotion_type varchar(30) NOT NULL,
  priority integer NOT NULL DEFAULT 0, starts_at timestamptz NOT NULL, ends_at timestamptz, conditions jsonb NOT NULL, rewards jsonb NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK(ends_at IS NULL OR ends_at >= starts_at), UNIQUE(id,company_id)
);
CREATE TABLE vouchers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), customer_id uuid, code varchar(80) NOT NULL, initial_amount numeric(19,4) NOT NULL CHECK(initial_amount > 0),
  balance numeric(19,4) NOT NULL CHECK(balance >= 0), expires_at timestamptz, status varchar(20) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE loyalty_accounts (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), customer_id uuid NOT NULL, points_balance numeric(19,4) NOT NULL DEFAULT 0,
  cashback_balance numeric(19,4) NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,customer_id), UNIQUE(id,company_id),
  FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), loyalty_account_id uuid NOT NULL, order_id uuid,
  transaction_type varchar(30) NOT NULL, points numeric(19,4) NOT NULL DEFAULT 0, cashback numeric(19,4) NOT NULL DEFAULT 0,
  expires_at timestamptz, idempotency_key varchar(120) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,idempotency_key),
  FOREIGN KEY(loyalty_account_id,company_id) REFERENCES loyalty_accounts(id,company_id), FOREIGN KEY(order_id,company_id) REFERENCES orders(id,company_id)
);
CREATE TABLE integrations (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, provider varchar(80) NOT NULL, integration_type varchar(40) NOT NULL,
  status varchar(20) NOT NULL, public_config jsonb NOT NULL DEFAULT '{}', secret_reference text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,branch_id,provider,integration_type), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE webhook_endpoints (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), url text NOT NULL, event_types text[] NOT NULL, signing_secret_reference text NOT NULL,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id)
);
CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), webhook_endpoint_id uuid NOT NULL, event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL, attempt integer NOT NULL DEFAULT 0, status varchar(20) NOT NULL, response_status integer, response_body text,
  next_attempt_at timestamptz, delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(webhook_endpoint_id,company_id) REFERENCES webhook_endpoints(id,company_id)
);
CREATE TABLE outbox_events (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), aggregate_type varchar(100) NOT NULL, aggregate_id uuid NOT NULL,
  event_type varchar(120) NOT NULL, payload jsonb NOT NULL, occurred_at timestamptz NOT NULL, published_at timestamptz, attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE notifications (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, type varchar(40) NOT NULL, severity varchar(20) NOT NULL,
  title varchar(160) NOT NULL, message text NOT NULL, target_path text, reference_type varchar(40), reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE user_notifications (
  id uuid PRIMARY KEY, notification_id uuid NOT NULL REFERENCES notifications(id), company_user_id uuid NOT NULL REFERENCES company_users(id), read_at timestamptz, dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(notification_id,company_user_id)
);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, user_id uuid REFERENCES users(id), action varchar(80) NOT NULL,
  entity_type varchar(100) NOT NULL, entity_id uuid, before_data jsonb, after_data jsonb, ip inet, correlation_id varchar(128), occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);

CREATE INDEX branches_company_idx ON branches(company_id) WHERE deleted_at IS NULL;
CREATE INDEX products_search_idx ON products(company_id,description) WHERE deleted_at IS NULL;
CREATE INDEX products_barcode_idx ON products(company_id,barcode) WHERE barcode IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX customers_name_idx ON customers(company_id,legal_name) WHERE deleted_at IS NULL;
CREATE INDEX suppliers_name_idx ON suppliers(company_id,legal_name) WHERE deleted_at IS NULL;
CREATE INDEX stock_lots_fefo_idx ON stock_lots(company_id,product_id,expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX stock_movements_history_idx ON stock_movements(company_id,branch_id,product_id,occurred_at DESC);
CREATE INDEX purchase_orders_status_idx ON purchase_orders(company_id,branch_id,status,ordered_at DESC);
CREATE INDEX orders_status_idx ON orders(company_id,branch_id,status,created_at DESC);
CREATE INDEX accounts_payable_due_idx ON accounts_payable(company_id,branch_id,status,due_date);
CREATE INDEX accounts_receivable_due_idx ON accounts_receivable(company_id,branch_id,status,due_date);
CREATE INDEX production_orders_status_idx ON production_orders(company_id,branch_id,status,planned_at);
CREATE INDEX deliveries_status_idx ON deliveries(company_id,branch_id,status,created_at);
CREATE INDEX outbox_pending_idx ON outbox_events(created_at) WHERE published_at IS NULL;
CREATE INDEX webhook_retry_idx ON webhook_deliveries(next_attempt_at) WHERE delivered_at IS NULL;
CREATE INDEX audit_lookup_idx ON audit_logs(company_id,entity_type,entity_id,occurred_at DESC);

CREATE OR REPLACE FUNCTION prevent_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are immutable';
END $$;
CREATE TRIGGER stock_movements_immutable BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
CREATE TRIGGER loyalty_transactions_immutable BEFORE UPDATE OR DELETE ON loyalty_transactions FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();

CREATE TABLE stock_transfers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), source_branch_id uuid NOT NULL, destination_branch_id uuid NOT NULL,
  status varchar(30) NOT NULL, shipped_at timestamptz, received_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,company_id), FOREIGN KEY(source_branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(destination_branch_id,company_id) REFERENCES branches(id,company_id),
  CHECK(source_branch_id <> destination_branch_id)
);
CREATE TABLE stock_transfer_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), transfer_id uuid NOT NULL, product_id uuid NOT NULL, lot_id uuid,
  quantity numeric(19,6) NOT NULL CHECK(quantity > 0), received_quantity numeric(19,6) NOT NULL DEFAULT 0 CHECK(received_quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(transfer_id,company_id) REFERENCES stock_transfers(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE inventories (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, warehouse_id uuid NOT NULL, status varchar(30) NOT NULL,
  started_at timestamptz, finished_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), FOREIGN KEY(warehouse_id,company_id) REFERENCES warehouses(id,company_id)
);
CREATE TABLE inventory_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), inventory_id uuid NOT NULL, product_id uuid NOT NULL, location_id uuid NOT NULL, lot_id uuid,
  expected_quantity numeric(19,6) NOT NULL, counted_quantity numeric(19,6), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(inventory_id,company_id) REFERENCES inventories(id,company_id), FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id),
  FOREIGN KEY(location_id,company_id) REFERENCES stock_locations(id,company_id), FOREIGN KEY(lot_id,company_id) REFERENCES stock_lots(id,company_id)
);
CREATE TABLE purchase_suggestions (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, forecast_days integer NOT NULL CHECK(forecast_days > 0),
  parameters jsonb NOT NULL, status varchar(30) NOT NULL, calculated_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE purchase_suggestion_items (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), suggestion_id uuid NOT NULL, product_id uuid NOT NULL,
  average_daily_sales numeric(19,6) NOT NULL, available_stock numeric(19,6) NOT NULL, safety_stock numeric(19,6) NOT NULL,
  pending_purchase numeric(19,6) NOT NULL, suggested_quantity numeric(19,6) NOT NULL CHECK(suggested_quantity >= 0), explanation jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(suggestion_id,company_id) REFERENCES purchase_suggestions(id,company_id),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), UNIQUE(suggestion_id,product_id)
);
CREATE TABLE price_tables (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), code varchar(40) NOT NULL, name varchar(120) NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(company_id,code), UNIQUE(id,company_id)
);
CREATE TABLE product_prices (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), product_id uuid NOT NULL, price_table_id uuid NOT NULL, branch_id uuid,
  cost numeric(19,4) NOT NULL CHECK(cost >= 0), sale_price numeric(19,4) NOT NULL CHECK(sale_price >= 0), minimum_price numeric(19,4) CHECK(minimum_price >= 0),
  valid_from timestamptz NOT NULL, valid_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(product_id,company_id) REFERENCES products(id,company_id), FOREIGN KEY(price_table_id,company_id) REFERENCES price_tables(id,company_id),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id), CHECK(valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE delivery_zones (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, calculation_type varchar(20) NOT NULL,
  name varchar(120) NOT NULL, rule_payload jsonb NOT NULL, fee numeric(19,4) NOT NULL CHECK(fee >= 0), active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE leads (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, owner_user_id uuid REFERENCES users(id), name varchar(160) NOT NULL,
  email varchar(254), phone varchar(30), source varchar(80), stage varchar(40) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE opportunities (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), lead_id uuid, customer_id uuid, owner_user_id uuid REFERENCES users(id), title varchar(180) NOT NULL,
  stage varchar(40) NOT NULL, estimated_value numeric(19,4) NOT NULL DEFAULT 0, probability numeric(5,2) NOT NULL DEFAULT 0 CHECK(probability BETWEEN 0 AND 100),
  expected_close_date date, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(lead_id,company_id) REFERENCES leads(id,company_id), FOREIGN KEY(customer_id,company_id) REFERENCES customers(id,company_id)
);
CREATE TABLE fiscal_settings (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, tax_regime varchar(30) NOT NULL,
  environment varchar(20) NOT NULL, certificate_secret_reference text, settings jsonb NOT NULL, valid_from date NOT NULL, valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id),
  CHECK(valid_until IS NULL OR valid_until >= valid_from)
);
CREATE TABLE printers (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid NOT NULL, name varchar(120) NOT NULL, computer_name varchar(120),
  system_name varchar(240) NOT NULL, status varchar(20) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id,system_name), UNIQUE(id,company_id), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE print_jobs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), printer_id uuid NOT NULL, document_type varchar(40) NOT NULL,
  reference_id uuid NOT NULL, payload jsonb NOT NULL, status varchar(20) NOT NULL, attempts integer NOT NULL DEFAULT 0, printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(printer_id,company_id) REFERENCES printers(id,company_id)
);
CREATE TABLE import_jobs (
  id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES companies(id), branch_id uuid, import_type varchar(40) NOT NULL, file_storage_key text NOT NULL,
  file_hash char(64) NOT NULL, status varchar(30) NOT NULL, total_rows integer NOT NULL DEFAULT 0, valid_rows integer NOT NULL DEFAULT 0, invalid_rows integer NOT NULL DEFAULT 0,
  confirmed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);
CREATE TABLE import_job_rows (
  id uuid PRIMARY KEY, import_job_id uuid NOT NULL REFERENCES import_jobs(id), row_number integer NOT NULL CHECK(row_number > 0), raw_data jsonb NOT NULL,
  normalized_data jsonb, errors jsonb NOT NULL DEFAULT '[]', imported_entity_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(import_job_id,row_number)
);

CREATE INDEX stock_transfer_status_idx ON stock_transfers(company_id,status,created_at DESC);
CREATE INDEX inventory_status_idx ON inventories(company_id,branch_id,status,created_at DESC);
CREATE INDEX product_prices_current_idx ON product_prices(company_id,product_id,price_table_id,valid_from DESC);
CREATE INDEX crm_leads_stage_idx ON leads(company_id,stage,created_at DESC);
CREATE INDEX print_jobs_pending_idx ON print_jobs(created_at) WHERE printed_at IS NULL;
