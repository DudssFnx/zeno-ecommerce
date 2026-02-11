-- Migration: Add api_endpoint to bling_credentials
ALTER TABLE bling_credentials
  ADD COLUMN api_endpoint text;

-- Make sure to run this migration (psql or your migration tool) to add the column before using the new feature.