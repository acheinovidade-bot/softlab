ALTER TABLE "branches"
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
