-- 0000: Extensions and helper functions
-- Runs before any table creation

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- RLS context helper: returns current org UUID from session config
CREATE OR REPLACE FUNCTION current_org_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- RLS context helper: returns current user UUID from session config
CREATE OR REPLACE FUNCTION current_user_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Generic trigger function: sets updated_at = now() on UPDATE
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- FTS trigger function: populates search_vector on submissions
CREATE OR REPLACE FUNCTION submissions_search_trigger() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', unaccent(
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.content, '') || ' ' ||
    COALESCE(NEW.cover_letter, '')
  ));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
