-- User keys for did:web DID document resolution (Track 5, Phase 2)
-- Per-user Ed25519 keypairs with RLS

--> statement-breakpoint
CREATE TABLE "user_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "key_id" varchar(512) NOT NULL,
  "algorithm" varchar(50) NOT NULL DEFAULT 'Ed25519',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE UNIQUE INDEX "user_keys_active_user_idx" ON "user_keys" ("user_id");

--> statement-breakpoint
ALTER TABLE "user_keys" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "user_keys" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "user_keys_owner_select" ON "user_keys" FOR SELECT
  USING (user_id = current_setting('app.user_id', true)::uuid);

--> statement-breakpoint
CREATE POLICY "user_keys_owner_insert" ON "user_keys" FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id', true)::uuid);

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "user_keys" TO "app_user";
