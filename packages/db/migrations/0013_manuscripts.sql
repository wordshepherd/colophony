-- Manuscript entity: manuscripts, manuscript_versions, files tables
-- Replaces submission_files with manuscript-version-centric file model
-- User-scoped RLS (owner_id = current_user_id()) — NOT org-scoped

-- ---------------------------------------------------------------------------
-- 1. Create manuscripts table
-- ---------------------------------------------------------------------------

CREATE TABLE "manuscripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manuscripts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manuscripts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "manuscripts_owner_id_idx" ON "manuscripts" USING btree ("owner_id");--> statement-breakpoint

CREATE POLICY "manuscripts_owner" ON "manuscripts" AS PERMISSIVE FOR ALL TO public USING (owner_id = current_user_id());--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "manuscripts" TO app_user;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Create manuscript_versions table
-- ---------------------------------------------------------------------------

CREATE TABLE "manuscript_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "manuscript_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "manuscript_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "manuscript_versions" ADD CONSTRAINT "manuscript_versions_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "manuscript_versions_manuscript_id_idx" ON "manuscript_versions" USING btree ("manuscript_id");--> statement-breakpoint
ALTER TABLE "manuscript_versions" ADD CONSTRAINT "manuscript_versions_manuscript_version_unique" UNIQUE ("manuscript_id", "version_number");--> statement-breakpoint

CREATE POLICY "manuscript_versions_owner" ON "manuscript_versions" AS PERMISSIVE FOR ALL TO public USING (manuscript_id IN (SELECT id FROM manuscripts WHERE owner_id = current_user_id()));--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "manuscript_versions" TO app_user;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Create files table (replaces submission_files)
-- ---------------------------------------------------------------------------

CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manuscript_version_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" varchar(1000) NOT NULL,
	"scan_status" "scan_status" DEFAULT 'PENDING' NOT NULL,
	"scanned_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "files" ADD CONSTRAINT "files_manuscript_version_id_manuscript_versions_id_fk" FOREIGN KEY ("manuscript_version_id") REFERENCES "public"."manuscript_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "files_manuscript_version_id_idx" ON "files" USING btree ("manuscript_version_id");--> statement-breakpoint
CREATE INDEX "files_version_scan_status_idx" ON "files" USING btree ("manuscript_version_id", "scan_status", "uploaded_at");--> statement-breakpoint

-- Owner CRUD: accessible via manuscript ownership chain
CREATE POLICY "files_owner" ON "files" AS PERMISSIVE FOR ALL TO public USING (manuscript_version_id IN (
    SELECT mv.id FROM manuscript_versions mv
    JOIN manuscripts m ON mv.manuscript_id = m.id
    WHERE m.owner_id = current_user_id()
  ));--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "files" TO app_user;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Add manuscript_version_id FK to submissions
-- ---------------------------------------------------------------------------

ALTER TABLE "submissions" ADD COLUMN "manuscript_version_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_manuscript_version_id_manuscript_versions_id_fk" FOREIGN KEY ("manuscript_version_id") REFERENCES "public"."manuscript_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submissions_manuscript_version_id_idx" ON "submissions" USING btree ("manuscript_version_id");--> statement-breakpoint

-- Org read: editors can read files on non-draft submissions in their org
-- (Must come after submissions.manuscript_version_id column is added above)
CREATE POLICY "files_org_read" ON "files" AS PERMISSIVE FOR SELECT TO public USING (manuscript_version_id IN (
    SELECT s.manuscript_version_id FROM submissions s
    WHERE s.organization_id = current_org_id()
    AND s.manuscript_version_id IS NOT NULL
    AND s.status != 'DRAFT'
  ));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 5. Add submitter-scoped SELECT policy on submissions
-- ---------------------------------------------------------------------------
-- Enables cross-org read of own submissions for getRelatedSubmissions()

CREATE POLICY "submissions_submitter_read" ON "submissions" AS PERMISSIVE FOR SELECT TO public USING (submitter_id = current_user_id());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 6. Drop submission_files table (replaced by files)
-- ---------------------------------------------------------------------------
-- No data migration needed: system has no production users. All existing
-- submission_files rows are seed/test data only. If this migration were
-- applied to a production system with real data, a backfill step would be
-- needed here to create manuscripts/versions/files from submission_files
-- rows and update submissions.manuscript_version_id accordingly.

DROP TABLE "submission_files";
