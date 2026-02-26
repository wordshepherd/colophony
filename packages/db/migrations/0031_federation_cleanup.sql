-- C1: New enums for varchar → enum conversions
CREATE TYPE "IdentityMigrationDirection" AS ENUM ('outbound', 'inbound');
--> statement-breakpoint
CREATE TYPE "HubInstanceStatus" AS ENUM ('active', 'suspended', 'revoked');
--> statement-breakpoint
CREATE TYPE "TrustInitiator" AS ENUM ('local', 'remote');
--> statement-breakpoint

-- C4: Inbound transfer status enum
CREATE TYPE "InboundTransferStatus" AS ENUM ('RECEIVED', 'FILES_FETCHING', 'FILES_COMPLETE', 'FAILED');
--> statement-breakpoint

-- C1: Swap varchar columns to enums
ALTER TABLE "identity_migrations"
  ALTER COLUMN "direction" TYPE "IdentityMigrationDirection" USING "direction"::"IdentityMigrationDirection";
--> statement-breakpoint

ALTER TABLE "hub_registered_instances"
  ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "hub_registered_instances"
  ALTER COLUMN "status" TYPE "HubInstanceStatus" USING "status"::"HubInstanceStatus";
--> statement-breakpoint
ALTER TABLE "hub_registered_instances"
  ALTER COLUMN "status" SET DEFAULT 'active'::"HubInstanceStatus";
--> statement-breakpoint

ALTER TABLE "trusted_peers"
  ALTER COLUMN "initiated_by" TYPE "TrustInitiator" USING "initiated_by"::"TrustInitiator";
--> statement-breakpoint

-- C4: Inbound transfers table
CREATE TABLE "inbound_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "submission_id" uuid REFERENCES "submissions"("id"),
  "source_domain" varchar(512) NOT NULL,
  "remote_transfer_id" varchar(255) NOT NULL,
  "submitter_did" varchar(512) NOT NULL,
  "content_fingerprint" varchar(64),
  "file_manifest" jsonb,
  "status" "InboundTransferStatus" NOT NULL DEFAULT 'RECEIVED',
  "failure_reason" text,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX "inbound_transfers_remote_unique"
  ON "inbound_transfers" ("source_domain", "remote_transfer_id");
--> statement-breakpoint

-- RLS
ALTER TABLE "inbound_transfers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "inbound_transfers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "inbound_transfers_org_isolation" ON "inbound_transfers"
  FOR ALL USING (organization_id = current_setting('app.current_org')::uuid);
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "inbound_transfers" TO app_user;
