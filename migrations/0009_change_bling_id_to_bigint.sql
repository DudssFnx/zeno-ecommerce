-- Migration 0009: Change bling_id columns to bigint to support large external IDs
ALTER TABLE products ALTER COLUMN bling_id TYPE bigint USING bling_id::bigint;
ALTER TABLE categories ALTER COLUMN bling_id TYPE bigint USING bling_id::bigint;

-- Recreate indexes (if any) are kept; if index exists, this keeps it usable for bigint
CREATE INDEX IF NOT EXISTS idx_products_bling_id ON products(bling_id);
CREATE INDEX IF NOT EXISTS idx_categories_bling_id ON categories(bling_id);
