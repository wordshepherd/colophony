-- 0025: Trusted peers — bilateral trust establishment for federation

-- Create PeerTrustStatus enum
CREATE TYPE "PeerTrustStatus" AS ENUM (
  'pending_outbound',
  'pending_inbound',
  'active',
  'rejected',
  'revoked'
);

--> statement-breakpoint

-- Create trusted_peers table
CREATE TABLE "trusted_peers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "domain" varchar(512) NOT NULL,
  "instance_url" varchar(1024) NOT NULL,
  "public_key" text NOT NULL,
  "key_id" varchar(512) NOT NULL,
  "granted_capabilities" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" "PeerTrustStatus" DEFAULT 'pending_outbound' NOT NULL,
  "initiated_by" varchar(10) NOT NULL,
  "protocol_version" varchar(20) DEFAULT '1.0' NOT NULL,
  "last_verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign key: organization_id → organizations
ALTER TABLE "trusted_peers"
  ADD CONSTRAINT "trusted_peers_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Unique constraint: one peer per org per domain
ALTER TABLE "trusted_peers"
  ADD CONSTRAINT "trusted_peers_org_domain_unique"
  UNIQUE ("organization_id", "domain");

--> statement-breakpoint

-- Indexes
CREATE INDEX "trusted_peers_organization_id_idx" ON "trusted_peers" USING btree ("organization_id");
CREATE INDEX "trusted_peers_domain_idx" ON "trusted_peers" USING btree ("domain");
CREATE INDEX "trusted_peers_org_status_idx" ON "trusted_peers" USING btree ("organization_id", "status");

--> statement-breakpoint

-- Enable RLS + FORCE
ALTER TABLE "trusted_peers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trusted_peers" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy
CREATE POLICY "trusted_peers_org_isolation" ON "trusted_peers"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint

-- GRANTs for app_user
GRANT SELECT, INSERT, UPDATE ON "trusted_peers" TO app_user;

--> statement-breakpoint

-- updatedAt trigger
CREATE TRIGGER "trg_trusted_peers_set_updated_at"
  BEFORE UPDATE ON "trusted_peers"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
