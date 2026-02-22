-- Add is_guest column to users
ALTER TABLE "users" ADD COLUMN "is_guest" boolean DEFAULT false NOT NULL;

--> statement-breakpoint

-- Replace non-unique lower(email) index with unique index
-- (prevents duplicate-case accounts like User@example.com and user@example.com)
DROP INDEX IF EXISTS "users_lower_email_idx";
CREATE UNIQUE INDEX "users_lower_email_unique_idx" ON "users" (lower("email"));

--> statement-breakpoint

-- Create embed_tokens table
CREATE TABLE "embed_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_period_id" uuid NOT NULL,
  "token_hash" varchar(128) NOT NULL,
  "token_prefix" varchar(16) NOT NULL,
  "allowed_origins" text[] DEFAULT ARRAY[]::text[] NOT NULL,
  "theme_config" jsonb DEFAULT '{}'::jsonb,
  "active" boolean DEFAULT true NOT NULL,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  CONSTRAINT "embed_tokens_token_hash_unique" UNIQUE("token_hash")
);

--> statement-breakpoint

-- Foreign keys
ALTER TABLE "embed_tokens"
  ADD CONSTRAINT "embed_tokens_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "embed_tokens"
  ADD CONSTRAINT "embed_tokens_submission_period_id_submission_periods_id_fk"
  FOREIGN KEY ("submission_period_id") REFERENCES "submission_periods"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "embed_tokens"
  ADD CONSTRAINT "embed_tokens_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE restrict ON UPDATE no action;

--> statement-breakpoint

-- Indexes
CREATE INDEX "embed_tokens_organization_id_idx" ON "embed_tokens" USING btree ("organization_id");
CREATE INDEX "embed_tokens_submission_period_id_idx" ON "embed_tokens" USING btree ("submission_period_id");
CREATE INDEX "embed_tokens_token_hash_idx" ON "embed_tokens" USING btree ("token_hash");

--> statement-breakpoint

-- Enable RLS (Drizzle generates this)
ALTER TABLE "embed_tokens" ENABLE ROW LEVEL SECURITY;

-- FORCE ROW LEVEL SECURITY (Drizzle only generates ENABLE, not FORCE)
ALTER TABLE "embed_tokens" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy: org isolation
CREATE POLICY "embed_tokens_org_isolation" ON "embed_tokens"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "embed_tokens" TO app_user;

--> statement-breakpoint

-- SECURITY DEFINER function: cross-org embed token lookup by hash
-- Joins submission_periods to return period data alongside token fields
CREATE OR REPLACE FUNCTION verify_embed_token(p_token_hash varchar)
RETURNS TABLE(
  id uuid, organization_id uuid, submission_period_id uuid,
  allowed_origins text[], theme_config jsonb,
  active boolean, expires_at timestamptz,
  period_name varchar, period_opens_at timestamptz,
  period_closes_at timestamptz, period_form_definition_id uuid,
  period_max_submissions integer, period_fee numeric
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT et.id, et.organization_id, et.submission_period_id,
         et.allowed_origins, et.theme_config,
         et.active, et.expires_at,
         sp.name, sp.opens_at, sp.closes_at,
         sp.form_definition_id, sp.max_submissions, sp.fee
  FROM public.embed_tokens et
  JOIN public.submission_periods sp ON sp.id = et.submission_period_id
  WHERE et.token_hash = p_token_hash
$$;

REVOKE ALL ON FUNCTION verify_embed_token(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_embed_token(varchar) TO app_user;
