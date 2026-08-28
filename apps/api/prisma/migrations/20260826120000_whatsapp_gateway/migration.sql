CREATE UNIQUE INDEX quotation_suppliers_id_company_uq ON quotation_suppliers(id, company_id);

CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  branch_id uuid NOT NULL,
  integration_id uuid NOT NULL,
  quotation_supplier_id uuid,
  direction varchar(12) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  recipient varchar(30) NOT NULL,
  message_type varchar(30) NOT NULL DEFAULT 'text',
  provider_message_id varchar(255),
  status varchar(20) NOT NULL,
  request_payload jsonb NOT NULL,
  response_payload jsonb,
  error_code varchar(80),
  error_message text,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_retry_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  responded_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (branch_id, company_id) REFERENCES branches(id, company_id),
  FOREIGN KEY (integration_id, company_id) REFERENCES integrations(id, company_id),
  FOREIGN KEY (quotation_supplier_id, company_id) REFERENCES quotation_suppliers(id, company_id)
);

CREATE INDEX whatsapp_messages_company_branch_status_idx ON whatsapp_messages(company_id, branch_id, status, created_at DESC);
CREATE INDEX whatsapp_messages_integration_created_idx ON whatsapp_messages(integration_id, created_at DESC);
CREATE UNIQUE INDEX whatsapp_messages_integration_provider_message_uq ON whatsapp_messages(integration_id, provider_message_id);

INSERT INTO plan_modules (id, plan_id, module_id, created_at, updated_at)
VALUES ('01992f80-0000-7000-8000-000000000010', '01992f10-0000-7000-8000-000000000001', '01992f10-0000-7000-8000-000000000113', now(), now())
ON CONFLICT (plan_id, module_id) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f80-0000-7000-8000-000000000001', 'integrations.whatsapp.read', 'integrations.whatsapp', 'read', now(), now()),
  ('01992f80-0000-7000-8000-000000000002', 'integrations.whatsapp.manage', 'integrations.whatsapp', 'manage', now(), now()),
  ('01992f80-0000-7000-8000-000000000003', 'integrations.whatsapp.send', 'integrations.whatsapp', 'send', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'integrations.whatsapp.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
