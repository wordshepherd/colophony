-- Hub tables for managed hosting federation
-- Migration: 0029_hub_tables

--> statement-breakpoint

-- Add hub columns to federation_config
ALTER TABLE "federation_config"
  ADD COLUMN "hub_attestation_token" text,
  ADD COLUMN "hub_attestation_expires_at" timestamp with time zone,
  ADD COLUMN "hub_domain" varchar(512);

--> statement-breakpoint

-- Add hub_attested column to trusted_peers
ALTER TABLE "trusted_peers"
  ADD COLUMN "hub_attested" boolean NOT NULL DEFAULT false;

--> statement-breakpoint

-- Hub registered instances (global, no RLS)
CREATE TABLE IF NOT EXISTS "hub_registered_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "domain" varchar(512) NOT NULL UNIQUE,
  "instance_url" varchar(1024) NOT NULL,
  "public_key" text NOT NULL,
  "key_id" varchar(512) NOT NULL,
  "attestation_token" text,
  "attestation_expires_at" timestamp with time zone,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "last_seen_at" timestamp with time zone,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hub_registered_instances_status_idx"
  ON "hub_registered_instances" ("status");

--> statement-breakpoint

-- Hub fingerprint index (global, no RLS)
CREATE TABLE IF NOT EXISTS "hub_fingerprint_index" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "source_domain" varchar(512) NOT NULL,
  "submitter_did" varchar(512) NOT NULL,
  "publication_name" varchar(255),
  "submitted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hub_fingerprint_index_fingerprint_idx"
  ON "hub_fingerprint_index" ("fingerprint");

--> statement-breakpoint

ALTER TABLE "hub_fingerprint_index"
  ADD CONSTRAINT "hub_fingerprint_index_domain_submitter_fp_unique"
  UNIQUE ("source_domain", "submitter_did", "fingerprint");

--> statement-breakpoint

-- Revoke app_user access to hub tables (same pattern as federation_config)
REVOKE ALL ON "hub_registered_instances" FROM "app_user";
REVOKE ALL ON "hub_fingerprint_index" FROM "app_user";
