-- User key rotation support
-- Migration: 0030_user_key_rotation

--> statement-breakpoint

-- Add rotation columns to user_keys
ALTER TABLE "user_keys"
  ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'active',
  ADD COLUMN "revoked_at" timestamp with time zone,
  ADD COLUMN "revoked_reason" text;

--> statement-breakpoint

-- Replace the unique-per-user index with a partial index (active keys only)
DROP INDEX IF EXISTS "user_keys_active_user_idx";

--> statement-breakpoint

CREATE UNIQUE INDEX "user_keys_active_user_idx" ON "user_keys" ("user_id") WHERE status = 'active';

--> statement-breakpoint

-- Composite index for queries by user + status
CREATE INDEX "user_keys_user_status_idx" ON "user_keys" ("user_id", "status");

--> statement-breakpoint

-- Grant UPDATE on user_keys to app_user (needed for revocation within withRls)
GRANT UPDATE ON "user_keys" TO "app_user";

--> statement-breakpoint

-- RLS policy: user can update own keys (for revocation)
CREATE POLICY "user_keys_owner_update" ON "user_keys"
  FOR UPDATE
  USING (user_id = current_setting('app.user_id', true)::uuid)
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);
