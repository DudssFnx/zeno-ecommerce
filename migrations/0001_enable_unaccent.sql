-- Migration: Enable unaccent extension to improve case-insensitive and accent-insensitive searches
-- Run this migration using your preferred migration tool or by applying the SQL directly with a superuser.

CREATE EXTENSION IF NOT EXISTS unaccent;
