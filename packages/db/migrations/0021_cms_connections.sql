-- 0021: CMS connections table

-- Create CmsAdapterType enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "CmsAdapterType" AS ENUM ('WORDPRESS', 'GHOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

-- Create cms_connections table
CREATE TABLE IF NOT EXISTS "cms_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "publication_id" uuid,
  "adapter_type" "CmsAdapterType" NOT NULL,
  "name" varchar(255) NOT NULL,
  "config" jsonb NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_sync_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Foreign keys (idempotent — check before adding)
DO $$ BEGIN
  ALTER TABLE "cms_connections"
    ADD CONSTRAINT "cms_connections_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cms_connections"
    ADD CONSTRAINT "cms_connections_publication_id_fk"
    FOREIGN KEY ("publication_id") REFERENCES "publications"("id")
    ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "cms_connections_organization_id_idx" ON "cms_connections" ("organization_id");
CREATE INDEX IF NOT EXISTS "cms_connections_publication_id_idx" ON "cms_connections" ("publication_id");

--> statement-breakpoint

-- RLS
ALTER TABLE "cms_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cms_connections" FORCE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "cms_connections_org_isolation" ON "cms_connections"
    FOR ALL
    USING (organization_id = current_org_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

--> statement-breakpoint

-- GRANT permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "cms_connections" TO app_user;

--> statement-breakpoint

-- updatedAt trigger (idempotent)
DROP TRIGGER IF EXISTS "trg_cms_connections_set_updated_at" ON "cms_connections";
CREATE TRIGGER "trg_cms_connections_set_updated_at"
  BEFORE UPDATE ON "cms_connections"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
