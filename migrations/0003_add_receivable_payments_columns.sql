-- Add new columns to receivable_payments used by detailed payments
ALTER TABLE receivable_payments
  ADD COLUMN IF NOT EXISTS original_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS interest numeric(12,2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS discount numeric(12,2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS fine numeric(12,2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS fee numeric(12,2) DEFAULT '0',
  ADD COLUMN IF NOT EXISTS financial_account_id integer,
  ADD COLUMN IF NOT EXISTS category_id integer,
  ADD COLUMN IF NOT EXISTS is_reversed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversed_at timestamp,
  ADD COLUMN IF NOT EXISTS reversed_by text,
  ADD COLUMN IF NOT EXISTS reversed_reason text,
  ADD COLUMN IF NOT EXISTS reversed_amount numeric(12,2);
