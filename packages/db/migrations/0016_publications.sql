-- 0016: Publications table + submission_periods.publication_id FK

-- Create PublicationStatus enum
CREATE TYPE "PublicationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

--> statement-breakpoint

-- Create publications table
CREATE TABLE "publications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" text,
  "settings" jsonb,
  "status" "PublicationStatus" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys
ALTER TABLE "publications"
  ADD CONSTRAINT "publications_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint

-- Indexes
CREATE INDEX "publications_organization_id_idx" ON "publications" USING btree ("organization_id");
CREATE UNIQUE INDEX "publications_org_slug_idx" ON "publications" USING btree ("organization_id", lower("slug"));

--> statement-breakpoint

-- Enable + FORCE RLS
ALTER TABLE "publications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "publications" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy: org isolation
CREATE POLICY "org_isolation" ON "publications"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "publications" TO app_user;

--> statement-breakpoint

-- Add publication_id FK to submission_periods
ALTER TABLE "submission_periods"
  ADD COLUMN "publication_id" uuid;

ALTER TABLE "submission_periods"
  ADD CONSTRAINT "submission_periods_publication_id_publications_id_fk"
  FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "submission_periods_publication_id_idx" ON "submission_periods" USING btree ("publication_id");

--> statement-breakpoint

-- updatedAt trigger (reuses the existing trigger function from 0002)
CREATE TRIGGER "trg_publications_set_updated_at"
  BEFORE UPDATE ON "publications"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
