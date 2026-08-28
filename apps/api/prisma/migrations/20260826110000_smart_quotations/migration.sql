ALTER TABLE quotations ADD COLUMN purchase_suggestion_id uuid;

ALTER TABLE quotations ADD CONSTRAINT quotations_purchase_suggestion_fk
  FOREIGN KEY (purchase_suggestion_id, company_id) REFERENCES purchase_suggestions(id, company_id);

CREATE UNIQUE INDEX quotations_purchase_suggestion_uq ON quotations(purchase_suggestion_id);

ALTER TABLE quotation_response_items
  ADD COLUMN payment_term_days integer CHECK (payment_term_days IS NULL OR payment_term_days >= 0);

CREATE UNIQUE INDEX quotation_items_quotation_product_uq ON quotation_items(quotation_id, product_id);
CREATE INDEX quotations_company_branch_status_idx ON quotations(company_id, branch_id, status, response_deadline);
CREATE INDEX quotation_suppliers_company_quotation_status_idx ON quotation_suppliers(company_id, quotation_id, status);
CREATE INDEX quotation_responses_company_item_idx ON quotation_response_items(company_id, quotation_item_id);

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f70-0000-7000-8000-000000000001', 'purchases.quotations.read', 'purchases.quotations', 'read', now(), now()),
  ('01992f70-0000-7000-8000-000000000002', 'purchases.quotations.manage', 'purchases.quotations', 'manage', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code IN ('purchases.quotations.read', 'purchases.quotations.manage')
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
