-- Migration: Add unique index to prevent multiple receivables for the same order
-- NOTE: This migration will FAIL if duplicate receivables for the same order exist.
-- Run `npx tsx server/scripts/inspectAllReceivables.ts` first to detect duplicates and repair them before applying.

CREATE UNIQUE INDEX IF NOT EXISTS ux_receivables_order_id_not_null ON receivables (order_id) WHERE order_id IS NOT NULL;
