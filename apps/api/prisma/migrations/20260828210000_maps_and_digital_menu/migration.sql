ALTER TABLE addresses
  ADD COLUMN latitude numeric(10,7),
  ADD COLUMN longitude numeric(10,7),
  ADD CONSTRAINT addresses_coordinates_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR
    (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
  );

ALTER TABLE food_tables ADD COLUMN public_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX food_tables_public_token_key ON food_tables(public_token);

ALTER TABLE food_tab_items ALTER COLUMN created_by DROP NOT NULL;

CREATE INDEX addresses_company_coordinates_idx ON addresses(company_id, latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
