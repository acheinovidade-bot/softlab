ALTER TABLE cash_sessions
  ADD CONSTRAINT cash_sessions_status_check CHECK (status IN ('open', 'closed'));

ALTER TABLE cash_movements
  ADD COLUMN payment_method_id uuid,
  ADD CONSTRAINT cash_movements_type_check CHECK (type IN ('opening', 'receipt', 'payment', 'supply', 'withdrawal')),
  ADD CONSTRAINT cash_movements_payment_method_fk FOREIGN KEY (payment_method_id, company_id) REFERENCES payment_methods(id, company_id);

CREATE UNIQUE INDEX cash_sessions_one_open_register_idx ON cash_sessions(company_id, cash_register_id) WHERE status = 'open';
CREATE INDEX cash_registers_company_branch_active_idx ON cash_registers(company_id, branch_id, active);
CREATE INDEX cash_sessions_register_status_idx ON cash_sessions(company_id, cash_register_id, status);
CREATE INDEX cash_sessions_operator_status_idx ON cash_sessions(company_id, operator_id, status);
CREATE INDEX cash_movements_session_occurred_idx ON cash_movements(company_id, cash_session_id, occurred_at DESC);

CREATE TABLE cash_closing_counts (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  cash_session_id uuid NOT NULL,
  payment_method_id uuid NOT NULL,
  system_amount numeric(19,4) NOT NULL,
  counted_amount numeric(19,4) NOT NULL CHECK(counted_amount >= 0),
  difference numeric(19,4) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cash_session_id, payment_method_id),
  FOREIGN KEY(cash_session_id, company_id) REFERENCES cash_sessions(id, company_id),
  FOREIGN KEY(payment_method_id, company_id) REFERENCES payment_methods(id, company_id)
);
CREATE INDEX cash_closing_counts_session_idx ON cash_closing_counts(company_id, cash_session_id);

INSERT INTO cash_registers (id, company_id, branch_id, code, name, active, created_at, updated_at)
SELECT gen_random_uuid(), b.company_id, b.id, 'CX-01', 'Caixa principal', true, now(), now()
FROM branches b
ON CONFLICT (branch_id, code) DO NOTHING;

INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992fc0-0000-7000-8000-000000000001', 'finance.cash.read', 'finance.cash', 'read', now(), now()),
  ('01992fc0-0000-7000-8000-000000000002', 'finance.cash.operate', 'finance.cash', 'operate', now(), now()),
  ('01992fc0-0000-7000-8000-000000000003', 'finance.cash.reopen', 'finance.cash', 'reopen', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code LIKE 'finance.cash.%'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
