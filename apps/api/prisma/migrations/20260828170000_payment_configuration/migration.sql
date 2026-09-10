CREATE TABLE card_operators (
  id uuid PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES companies(id),
  code varchar(40) NOT NULL,
  name varchar(120) NOT NULL,
  tax_id varchar(14),
  debit_rate numeric(9,4) NOT NULL DEFAULT 0,
  credit_rate numeric(9,4) NOT NULL DEFAULT 0,
  installment_rate numeric(9,4) NOT NULL DEFAULT 0,
  settlement_days integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT card_operators_company_code_key UNIQUE(company_id, code),
  CONSTRAINT card_operators_id_company_key UNIQUE(id, company_id),
  CONSTRAINT card_operators_rates_check CHECK (
    debit_rate BETWEEN 0 AND 100 AND credit_rate BETWEEN 0 AND 100 AND installment_rate BETWEEN 0 AND 100
  ),
  CONSTRAINT card_operators_settlement_days_check CHECK (settlement_days BETWEEN 0 AND 365)
);
CREATE INDEX card_operators_company_active_idx ON card_operators(company_id, active);

ALTER TABLE payment_methods
  ADD COLUMN card_operator_id uuid,
  ADD COLUMN fiscal_code varchar(4) NOT NULL DEFAULT '99',
  ADD COLUMN max_installments integer NOT NULL DEFAULT 1,
  ADD COLUMN creates_receivable boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT payment_methods_card_operator_fk
    FOREIGN KEY (card_operator_id, company_id) REFERENCES card_operators(id, company_id),
  ADD CONSTRAINT payment_methods_installments_check CHECK (max_installments BETWEEN 1 AND 48);
CREATE INDEX payment_methods_card_operator_idx ON payment_methods(company_id, card_operator_id);

ALTER TABLE payments
  ADD COLUMN installments integer NOT NULL DEFAULT 1,
  ADD COLUMN fee_amount numeric(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN net_amount numeric(19,4) NOT NULL DEFAULT 0,
  ADD CONSTRAINT payments_installments_check CHECK (installments BETWEEN 1 AND 48);

UPDATE payments SET net_amount = amount WHERE net_amount = 0;
