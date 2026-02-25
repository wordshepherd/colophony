-- 0026: Sim-sub enforcement — content fingerprinting and cross-instance checks

-- Create SimSubCheckResult enum
CREATE TYPE "SimSubCheckResult" AS ENUM (
  'CLEAR',
  'CONFLICT',
  'PARTIAL',
  'SKIPPED'
);

--> statement-breakpoint

-- Add content_fingerprint to manuscript_versions
ALTER TABLE "manuscript_versions"
  ADD COLUMN "content_fingerprint" varchar(64);

--> statement-breakpoint

-- Index on content_fingerprint for fingerprint lookups
CREATE INDEX "manuscript_versions_fingerprint_idx"
  ON "manuscript_versions" USING btree ("content_fingerprint");

--> statement-breakpoint

-- Add sim_sub_prohibited to submission_periods
ALTER TABLE "submission_periods"
  ADD COLUMN "sim_sub_prohibited" boolean NOT NULL DEFAULT false;

--> statement-breakpoint

-- Add sim-sub tracking columns to submissions
ALTER TABLE "submissions"
  ADD COLUMN "sim_sub_override" boolean NOT NULL DEFAULT false,
  ADD COLUMN "sim_sub_check_result" "SimSubCheckResult",
  ADD COLUMN "sim_sub_checked_at" timestamp with time zone;

--> statement-breakpoint

-- Create sim_sub_checks table
CREATE TABLE "sim_sub_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "submitter_did" varchar(512) NOT NULL,
  "result" "SimSubCheckResult" NOT NULL,
  "local_conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "remote_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "overridden_by" uuid,
  "overridden_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys for sim_sub_checks
ALTER TABLE "sim_sub_checks"
  ADD CONSTRAINT "sim_sub_checks_submission_id_submissions_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "submissions" ("id")
  ON DELETE CASCADE;

ALTER TABLE "sim_sub_checks"
  ADD CONSTRAINT "sim_sub_checks_overridden_by_users_id_fk"
  FOREIGN KEY ("overridden_by") REFERENCES "users" ("id")
  ON DELETE SET NULL;

--> statement-breakpoint

-- Indexes for sim_sub_checks
CREATE INDEX "sim_sub_checks_submission_id_idx"
  ON "sim_sub_checks" USING btree ("submission_id");
CREATE INDEX "sim_sub_checks_fingerprint_idx"
  ON "sim_sub_checks" USING btree ("fingerprint");

--> statement-breakpoint

-- Enable RLS + FORCE on sim_sub_checks
ALTER TABLE "sim_sub_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sim_sub_checks" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy for sim_sub_checks (via submission org isolation)
CREATE POLICY "sim_sub_checks_org_isolation" ON "sim_sub_checks"
  FOR ALL
  USING (submission_id IN (
    SELECT id FROM submissions
    WHERE organization_id = current_org_id()
  ));

--> statement-breakpoint

-- GRANTs for app_user
GRANT SELECT, INSERT, UPDATE ON "sim_sub_checks" TO app_user;
