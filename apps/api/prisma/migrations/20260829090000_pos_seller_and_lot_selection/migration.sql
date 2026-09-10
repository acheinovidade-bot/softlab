ALTER TABLE "pos_settings"
  ADD COLUMN "seller_mode" VARCHAR(20) NOT NULL DEFAULT 'default';

ALTER TABLE "pos_settings"
  ADD CONSTRAINT "pos_settings_seller_mode_check"
  CHECK ("seller_mode" IN ('default', 'per_sale'));

ALTER TABLE "products"
  ADD COLUMN "select_lot_at_pos" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "products"
  ADD CONSTRAINT "products_pos_lot_requires_lot_check"
  CHECK (NOT "select_lot_at_pos" OR "controls_lot");
