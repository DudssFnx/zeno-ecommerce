-- Add sell_price to purchase_order_items
ALTER TABLE purchase_order_items
  ADD COLUMN sell_price numeric(10,2);

-- Backfill: set sell_price to NULL (no-op, but explicit)
UPDATE purchase_order_items SET sell_price = NULL WHERE sell_price IS NULL;