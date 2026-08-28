ALTER TABLE products
  ADD COLUMN image_storage_key text,
  ADD COLUMN ncm varchar(8), ADD COLUMN cest varchar(7), ADD COLUMN origin varchar(1),
  ADD COLUMN cfop varchar(4), ADD COLUMN cst varchar(3), ADD COLUMN csosn varchar(3), ADD COLUMN tax_profile jsonb,
  ADD COLUMN delivery_enabled boolean NOT NULL DEFAULT false, ADD COLUMN delivery_name varchar(160),
  ADD COLUMN delivery_description text, ADD COLUMN delivery_price numeric(19,4), ADD COLUMN print_sector varchar(40),
  ADD CONSTRAINT products_fiscal_codes_check CHECK (
    (ncm IS NULL OR ncm ~ '^[0-9]{8}$') AND (cest IS NULL OR cest ~ '^[0-9]{7}$') AND
    (cfop IS NULL OR cfop ~ '^[0-9]{4}$') AND (cst IS NULL OR cst ~ '^[0-9]{3}$') AND (csosn IS NULL OR csosn ~ '^[0-9]{3}$')
  ), ADD CONSTRAINT products_delivery_price_check CHECK (delivery_price IS NULL OR delivery_price >= 0);
ALTER TABLE product_prices ADD COLUMN commission_rate numeric(9,4) NOT NULL DEFAULT 0 CHECK (commission_rate BETWEEN 0 AND 100);

ALTER TABLE product_groups ADD CONSTRAINT product_groups_id_company_uq UNIQUE(id, company_id);
ALTER TABLE product_categories ADD CONSTRAINT product_categories_id_company_uq UNIQUE(id, company_id);
ALTER TABLE brands ADD CONSTRAINT brands_id_company_uq UNIQUE(id, company_id);
ALTER TABLE units ADD CONSTRAINT units_id_company_uq UNIQUE(id, company_id);
ALTER TABLE products
  ADD CONSTRAINT products_group_company_fk FOREIGN KEY(group_id, company_id) REFERENCES product_groups(id, company_id),
  ADD CONSTRAINT products_category_company_fk FOREIGN KEY(category_id, company_id) REFERENCES product_categories(id, company_id),
  ADD CONSTRAINT products_brand_company_fk FOREIGN KEY(brand_id, company_id) REFERENCES brands(id, company_id),
  ADD CONSTRAINT products_unit_company_fk FOREIGN KEY(unit_id, company_id) REFERENCES units(id, company_id),
  ADD CONSTRAINT products_expiry_requires_lot_check CHECK (NOT controls_expiry OR controls_lot);

CREATE INDEX products_company_description_idx ON products(company_id, description) WHERE deleted_at IS NULL;
CREATE INDEX products_company_reference_idx ON products(company_id, reference) WHERE deleted_at IS NULL;
CREATE INDEX product_branch_settings_product_idx ON product_branch_settings(company_id, product_id);
CREATE UNIQUE INDEX product_prices_one_current_uq
  ON product_prices(company_id, product_id, price_table_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE valid_until IS NULL;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f30-0000-7000-8000-000000000001', 'catalog.products.read', 'catalog.products', 'read', now(), now()),
  ('01992f30-0000-7000-8000-000000000002', 'catalog.products.manage', 'catalog.products', 'manage', now(), now()),
  ('01992f30-0000-7000-8000-000000000003', 'catalog.cost.read', 'catalog.cost', 'read', now(), now()),
  ('01992f30-0000-7000-8000-000000000004', 'catalog.price.manage', 'catalog.price', 'manage', now(), now())
ON CONFLICT (code) DO NOTHING;
