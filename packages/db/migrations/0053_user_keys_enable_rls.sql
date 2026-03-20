-- Fix: user_keys has pgPolicy definitions but was missing .enableRLS() in schema.
-- Migration 0024 already applied these statements, so they are idempotent no-ops.
ALTER TABLE "user_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_keys" FORCE ROW LEVEL SECURITY;
