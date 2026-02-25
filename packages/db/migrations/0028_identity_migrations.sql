-- 0028: Identity migrations — cross-instance identity migration tracking

-- Create IdentityMigrationStatus enum
CREATE TYPE "IdentityMigrationStatus" AS ENUM (
  'PENDING',
  'PENDING_APPROVAL',
  'APPROVED',
  'BUNDLE_SENT',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'EXPIRED',
  'CANCELLED'
);

--> statement-breakpoint

-- Add migration columns to users
ALTER TABLE "users"
  ADD COLUMN "migrated_to_domain" varchar(512),
  ADD COLUMN "migrated_to_did" varchar(512),
  ADD COLUMN "migrated_at" timestamp with time zone;

--> statement-breakpoint

-- Partial index on migrated_to_domain
CREATE INDEX "users_migrated_to_domain_idx"
  ON "users" ("migrated_to_domain")
  WHERE migrated_to_domain IS NOT NULL;

--> statement-breakpoint

-- Create identity_migrations table
CREATE TABLE "identity_migrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid,
  "direction" varchar(10) NOT NULL,
  "peer_domain" varchar(512) NOT NULL,
  "peer_instance_url" varchar(1024),
  "user_did" varchar(512),
  "peer_user_did" varchar(512),
  "status" "IdentityMigrationStatus" DEFAULT 'PENDING' NOT NULL,
  "migration_token" text,
  "token_expires_at" timestamp with time zone,
  "callback_url" varchar(1024),
  "bundle_metadata" jsonb,
  "failure_reason" text,
  "approved_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys
ALTER TABLE "identity_migrations"
  ADD CONSTRAINT "identity_migrations_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE;

ALTER TABLE "identity_migrations"
  ADD CONSTRAINT "identity_migrations_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Indexes
CREATE INDEX "identity_migrations_user_id_idx"
  ON "identity_migrations" USING btree ("user_id");
CREATE INDEX "identity_migrations_peer_domain_idx"
  ON "identity_migrations" USING btree ("peer_domain");
CREATE INDEX "identity_migrations_status_idx"
  ON "identity_migrations" USING btree ("status");

-- Partial unique index: prevents concurrent active migrations for same user+direction+domain
CREATE UNIQUE INDEX "identity_migrations_active_unique"
  ON "identity_migrations" ("user_id", "direction", "peer_domain")
  WHERE status NOT IN ('COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED');

--> statement-breakpoint

-- Enable RLS + FORCE on identity_migrations
ALTER TABLE "identity_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identity_migrations" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy for identity_migrations (user-scoped, same as user_keys)
CREATE POLICY "identity_migrations_user_isolation" ON "identity_migrations"
  FOR ALL
  USING (user_id = current_setting('app.user_id', true)::uuid);

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "identity_migrations" TO app_user;
