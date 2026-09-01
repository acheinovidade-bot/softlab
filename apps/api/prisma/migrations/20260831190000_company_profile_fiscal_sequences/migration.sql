ALTER TABLE "companies"
  ADD COLUMN "state_registration" VARCHAR(40),
  ADD COLUMN "municipal_registration" VARCHAR(40),
  ADD COLUMN "tax_regime" VARCHAR(40),
  ADD COLUMN "cnae" VARCHAR(12),
  ADD COLUMN "phone" VARCHAR(30),
  ADD COLUMN "email" VARCHAR(254),
  ADD COLUMN "postal_code" VARCHAR(8),
  ADD COLUMN "street" VARCHAR(180),
  ADD COLUMN "address_number" VARCHAR(30),
  ADD COLUMN "complement" VARCHAR(120),
  ADD COLUMN "district" VARCHAR(120),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "state" CHAR(2);

ALTER TABLE "fiscal_pos_terminals"
  ADD COLUMN "nfe_series" VARCHAR(10) NOT NULL DEFAULT '1',
  ADD COLUMN "last_order_number" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "last_nfce_number" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "last_nfce_offline_number" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN "last_nfe_number" BIGINT NOT NULL DEFAULT 0;
