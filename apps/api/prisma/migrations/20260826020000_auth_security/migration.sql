ALTER TABLE sessions ADD COLUMN company_id uuid;
ALTER TABLE sessions ADD COLUMN branch_id uuid;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_company_fk FOREIGN KEY(company_id) REFERENCES companies(id),
  ADD CONSTRAINT sessions_branch_company_fk FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id);

ALTER TABLE sessions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE sessions ALTER COLUMN branch_id SET NOT NULL;

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY, company_id uuid REFERENCES companies(id), branch_id uuid, user_id uuid REFERENCES users(id),
  email_hash char(64) NOT NULL, success boolean NOT NULL, failure_reason varchar(60), ip inet, user_agent text,
  occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(branch_id,company_id) REFERENCES branches(id,company_id)
);

CREATE INDEX login_attempts_security_idx ON login_attempts(company_id,email_hash,occurred_at DESC);
CREATE TRIGGER login_attempts_immutable BEFORE UPDATE OR DELETE ON login_attempts FOR EACH ROW EXECUTE FUNCTION prevent_ledger_mutation();
