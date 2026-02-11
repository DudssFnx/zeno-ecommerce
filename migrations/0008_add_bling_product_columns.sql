-- Migration 0008: Add bling_id and bling_last_synced_at to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS bling_id integer,
  ADD COLUMN IF NOT EXISTS bling_last_synced_at timestamp;

-- Optional: index on bling_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_bling_id ON products(bling_id);