-- 0027: Piece transfers — cross-instance submission transfer tracking

-- Create PieceTransferStatus enum
CREATE TYPE "PieceTransferStatus" AS ENUM (
  'PENDING',
  'FILES_REQUESTED',
  'COMPLETED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

--> statement-breakpoint

-- Add transfer provenance columns to submissions
ALTER TABLE "submissions"
  ADD COLUMN "transferred_from_domain" varchar(512),
  ADD COLUMN "transferred_from_transfer_id" varchar(255);

--> statement-breakpoint

-- Partial unique index for inbound transfer idempotency
CREATE UNIQUE INDEX "submissions_transfer_provenance_unique"
  ON "submissions" ("transferred_from_domain", "transferred_from_transfer_id")
  WHERE transferred_from_domain IS NOT NULL;

--> statement-breakpoint

-- Create piece_transfers table
CREATE TABLE "piece_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL,
  "manuscript_version_id" uuid NOT NULL,
  "initiated_by_user_id" uuid NOT NULL,
  "target_domain" varchar(512) NOT NULL,
  "status" "PieceTransferStatus" DEFAULT 'PENDING' NOT NULL,
  "transfer_token" text NOT NULL,
  "token_expires_at" timestamp with time zone NOT NULL,
  "file_manifest" jsonb NOT NULL,
  "content_fingerprint" varchar(64),
  "submitter_did" varchar(512) NOT NULL,
  "remote_transfer_id" varchar(255),
  "remote_response" jsonb,
  "failure_reason" text,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys for piece_transfers
ALTER TABLE "piece_transfers"
  ADD CONSTRAINT "piece_transfers_submission_id_submissions_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "submissions" ("id")
  ON DELETE CASCADE;

ALTER TABLE "piece_transfers"
  ADD CONSTRAINT "piece_transfers_manuscript_version_id_manuscript_versions_id_fk"
  FOREIGN KEY ("manuscript_version_id") REFERENCES "manuscript_versions" ("id")
  ON DELETE CASCADE;

ALTER TABLE "piece_transfers"
  ADD CONSTRAINT "piece_transfers_initiated_by_user_id_users_id_fk"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Indexes for piece_transfers
CREATE INDEX "piece_transfers_submission_id_idx"
  ON "piece_transfers" USING btree ("submission_id");
CREATE INDEX "piece_transfers_initiated_by_user_id_idx"
  ON "piece_transfers" USING btree ("initiated_by_user_id");
CREATE INDEX "piece_transfers_target_domain_idx"
  ON "piece_transfers" USING btree ("target_domain");
CREATE INDEX "piece_transfers_status_idx"
  ON "piece_transfers" USING btree ("status");

--> statement-breakpoint

-- Enable RLS + FORCE on piece_transfers
ALTER TABLE "piece_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "piece_transfers" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy for piece_transfers (via submission org isolation)
CREATE POLICY "piece_transfers_org_isolation" ON "piece_transfers"
  FOR ALL
  USING (submission_id IN (
    SELECT id FROM submissions
    WHERE organization_id = current_org_id()
  ));

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "piece_transfers" TO app_user;
