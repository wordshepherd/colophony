-- Federation Discovery (Track 5, Phase 1)
-- Instance-level singleton config table + org opt-out column

--> statement-breakpoint
CREATE TYPE "public"."FederationMode" AS ENUM('allowlist', 'open', 'managed_hub');

--> statement-breakpoint
CREATE TABLE "federation_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "singleton" boolean NOT NULL DEFAULT true UNIQUE,
  "public_key" text NOT NULL,
  "private_key" text NOT NULL,
  "key_id" varchar(512) NOT NULL,
  "mode" "FederationMode" NOT NULL DEFAULT 'allowlist',
  "contact_email" varchar(255),
  "capabilities" jsonb NOT NULL DEFAULT '["identity"]'::jsonb,
  "enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

--> statement-breakpoint
REVOKE ALL ON "federation_config" FROM "app_user";

--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "federation_opted_out" boolean NOT NULL DEFAULT false;
