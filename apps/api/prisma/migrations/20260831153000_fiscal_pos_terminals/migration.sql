CREATE TABLE fiscal_pos_terminals (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  pos_number integer NOT NULL CHECK (pos_number > 0),
  description varchar(160) NOT NULL,
  cash_register_code varchar(40) NOT NULL,
  csc_token varchar(80) NOT NULL,
  csc_code varchar(200) NOT NULL,
  online_series varchar(10) NOT NULL,
  offline_series varchar(10) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fiscal_pos_terminals_company_branch_pos_key UNIQUE (company_id, branch_id, pos_number),
  CONSTRAINT fiscal_pos_terminals_company_branch_online_series_key UNIQUE (company_id, branch_id, online_series),
  CONSTRAINT fiscal_pos_terminals_company_branch_offline_series_key UNIQUE (company_id, branch_id, offline_series),
  CONSTRAINT fiscal_pos_terminals_branch_fk FOREIGN KEY (branch_id, company_id) REFERENCES branches(id, company_id)
);

CREATE INDEX fiscal_pos_terminals_branch_active_idx
  ON fiscal_pos_terminals(company_id, branch_id, active);

ALTER TABLE fiscal_documents ADD COLUMN pos_terminal_id uuid;
ALTER TABLE fiscal_documents
  ADD CONSTRAINT fiscal_documents_pos_terminal_fk FOREIGN KEY (pos_terminal_id) REFERENCES fiscal_pos_terminals(id);
CREATE INDEX fiscal_documents_terminal_series_idx
  ON fiscal_documents(company_id, branch_id, pos_terminal_id, series);
