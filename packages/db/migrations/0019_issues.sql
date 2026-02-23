-- 0019: Issue tables — issues, issue_sections, issue_items

-- Create IssueStatus enum
CREATE TYPE "IssueStatus" AS ENUM (
  'PLANNING',
  'ASSEMBLING',
  'READY',
  'PUBLISHED',
  'ARCHIVED'
);

--> statement-breakpoint

-- Create issues table
CREATE TABLE "issues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "publication_id" uuid NOT NULL,
  "title" varchar(500) NOT NULL,
  "volume" integer,
  "issue_number" integer,
  "description" text,
  "cover_image_url" varchar(1000),
  "status" "IssueStatus" DEFAULT 'PLANNING' NOT NULL,
  "publication_date" timestamp with time zone,
  "published_at" timestamp with time zone,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Create issue_sections table
CREATE TABLE "issue_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "issue_id" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Create issue_items table
CREATE TABLE "issue_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "issue_id" uuid NOT NULL,
  "pipeline_item_id" uuid NOT NULL,
  "issue_section_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys: issues
ALTER TABLE "issues"
  ADD CONSTRAINT "issues_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "issues"
  ADD CONSTRAINT "issues_publication_id_publications_id_fk"
  FOREIGN KEY ("publication_id") REFERENCES "publications" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Foreign keys: issue_sections
ALTER TABLE "issue_sections"
  ADD CONSTRAINT "issue_sections_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Foreign keys: issue_items
ALTER TABLE "issue_items"
  ADD CONSTRAINT "issue_items_issue_id_issues_id_fk"
  FOREIGN KEY ("issue_id") REFERENCES "issues" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "issue_items"
  ADD CONSTRAINT "issue_items_pipeline_item_id_pipeline_items_id_fk"
  FOREIGN KEY ("pipeline_item_id") REFERENCES "pipeline_items" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "issue_items"
  ADD CONSTRAINT "issue_items_issue_section_id_issue_sections_id_fk"
  FOREIGN KEY ("issue_section_id") REFERENCES "issue_sections" ("id")
  ON DELETE SET NULL;

--> statement-breakpoint

-- Unique constraint: one pipeline item per issue
ALTER TABLE "issue_items"
  ADD CONSTRAINT "issue_items_issue_pipeline_unique"
  UNIQUE ("issue_id", "pipeline_item_id");

--> statement-breakpoint

-- Indexes: issues
CREATE INDEX "issues_organization_id_idx" ON "issues" USING btree ("organization_id");
CREATE INDEX "issues_publication_id_idx" ON "issues" USING btree ("publication_id");
CREATE INDEX "issues_pub_date_idx" ON "issues" USING btree ("publication_id", "publication_date");
CREATE INDEX "issues_org_status_idx" ON "issues" USING btree ("organization_id", "status");

--> statement-breakpoint

-- Indexes: issue_sections
CREATE INDEX "issue_sections_issue_id_idx" ON "issue_sections" USING btree ("issue_id");

--> statement-breakpoint

-- Indexes: issue_items
CREATE INDEX "issue_items_issue_id_idx" ON "issue_items" USING btree ("issue_id");
CREATE INDEX "issue_items_pipeline_item_id_idx" ON "issue_items" USING btree ("pipeline_item_id");

--> statement-breakpoint

-- Enable RLS + FORCE on all tables
ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" FORCE ROW LEVEL SECURITY;
ALTER TABLE "issue_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_sections" FORCE ROW LEVEL SECURITY;
ALTER TABLE "issue_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issue_items" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policies
CREATE POLICY "org_isolation" ON "issues"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY "issue_section_org_isolation" ON "issue_sections"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_id AND issues.organization_id = current_org_id()));

CREATE POLICY "issue_item_org_isolation" ON "issue_items"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_id AND issues.organization_id = current_org_id()));

--> statement-breakpoint

-- GRANTs for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "issues" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "issue_sections" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "issue_items" TO app_user;

--> statement-breakpoint

-- updatedAt trigger (issues only — sections and items don't have updatedAt)
CREATE TRIGGER "trg_issues_set_updated_at"
  BEFORE UPDATE ON "issues"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
