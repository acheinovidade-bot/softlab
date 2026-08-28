CREATE INDEX supplier_products_company_supplier_idx
  ON supplier_products(company_id, supplier_id);

CREATE INDEX supplier_products_company_product_price_idx
  ON supplier_products(company_id, product_id, last_price)
  WHERE last_price IS NOT NULL;
