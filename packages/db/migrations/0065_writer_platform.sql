-- Writer Platform Enhancements (Track 14)
-- New enums: PortfolioEntryType, SimsubGroupStatus
-- New tables: simsub_groups, simsub_group_submissions, portfolio_entries, reader_feedback

--> statement-breakpoint
CREATE TYPE "public"."PortfolioEntryType" AS ENUM('colophony_verified', 'federation_verified', 'external');

--> statement-breakpoint
CREATE TYPE "public"."SimsubGroupStatus" AS ENUM('ACTIVE', 'RESOLVED', 'WITHDRAWN');

--> statement-breakpoint
CREATE TABLE "simsub_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "manuscript_id" uuid,
  "status" "SimsubGroupStatus" NOT NULL DEFAULT 'ACTIVE',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "simsub_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "simsub_groups_manuscript_id_manuscripts_id_fk" FOREIGN KEY ("manuscript_id") REFERENCES "public"."manuscripts"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "simsub_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "simsub_groups" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "user_owner" ON "simsub_groups" AS PERMISSIVE FOR ALL USING (user_id = current_user_id());

--> statement-breakpoint
CREATE INDEX "simsub_groups_user_id_idx" ON "simsub_groups" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "simsub_groups_user_status_idx" ON "simsub_groups" USING btree ("user_id", "status");
--> statement-breakpoint
CREATE INDEX "simsub_groups_manuscript_id_idx" ON "simsub_groups" USING btree ("manuscript_id");

--> statement-breakpoint
CREATE TABLE "simsub_group_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "simsub_group_id" uuid NOT NULL,
  "submission_id" uuid,
  "external_submission_id" uuid,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "simsub_group_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "simsub_group_submissions_simsub_group_id_simsub_groups_id_fk" FOREIGN KEY ("simsub_group_id") REFERENCES "public"."simsub_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "simsub_group_submissions_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "simsub_group_submissions_external_submission_id_external_submissions_id_fk" FOREIGN KEY ("external_submission_id") REFERENCES "public"."external_submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "simsub_group_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "simsub_group_submissions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "simsub_group_submissions_user_owner" ON "simsub_group_submissions" AS PERMISSIVE FOR ALL USING (user_id = current_user_id());

--> statement-breakpoint
ALTER TABLE "simsub_group_submissions" ADD CONSTRAINT "simsub_group_submissions_source_xor"
  CHECK ((submission_id IS NOT NULL)::int + (external_submission_id IS NOT NULL)::int = 1);

--> statement-breakpoint
CREATE INDEX "simsub_group_submissions_group_id_idx" ON "simsub_group_submissions" USING btree ("simsub_group_id");
--> statement-breakpoint
CREATE INDEX "simsub_group_submissions_submission_id_idx" ON "simsub_group_submissions" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "simsub_group_submissions_external_id_idx" ON "simsub_group_submissions" USING btree ("external_submission_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "simsub_group_submissions_group_submission_idx"
  ON "simsub_group_submissions" ("simsub_group_id", "submission_id")
  WHERE submission_id IS NOT NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX "simsub_group_submissions_group_external_idx"
  ON "simsub_group_submissions" ("simsub_group_id", "external_submission_id")
  WHERE external_submission_id IS NOT NULL;

--> statement-breakpoint
CREATE TABLE "portfolio_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" "PortfolioEntryType" NOT NULL,
  "title" varchar(500) NOT NULL,
  "publication_name" varchar(500) NOT NULL,
  "published_at" timestamptz,
  "url" varchar(2048),
  "contributor_publication_id" uuid,
  "federation_source_instance" varchar(512),
  "federation_entry_id" uuid,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "portfolio_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "portfolio_entries_contributor_publication_id_contributor_publications_id_fk" FOREIGN KEY ("contributor_publication_id") REFERENCES "public"."contributor_publications"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "portfolio_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "portfolio_entries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "portfolio_entries_user_owner" ON "portfolio_entries" AS PERMISSIVE FOR ALL USING (user_id = current_user_id());

--> statement-breakpoint
CREATE INDEX "portfolio_entries_user_id_idx" ON "portfolio_entries" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "portfolio_entries_user_type_idx" ON "portfolio_entries" USING btree ("user_id", "type");
--> statement-breakpoint
CREATE INDEX "portfolio_entries_contributor_publication_id_idx" ON "portfolio_entries" USING btree ("contributor_publication_id");

--> statement-breakpoint
CREATE TABLE "reader_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "reviewer_user_id" uuid,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "comment" varchar(280),
  "is_forwardable" boolean NOT NULL DEFAULT false,
  "forwarded_at" timestamptz,
  "forwarded_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reader_feedback_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "reader_feedback_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "reader_feedback_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "reader_feedback_forwarded_by_users_id_fk" FOREIGN KEY ("forwarded_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "reader_feedback" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "reader_feedback" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "reader_feedback_org_isolation" ON "reader_feedback" AS PERMISSIVE FOR ALL USING (organization_id = current_org_id());

--> statement-breakpoint
CREATE POLICY "reader_feedback_submitter_forwarded_read" ON "reader_feedback" AS PERMISSIVE FOR SELECT USING (
  forwarded_at IS NOT NULL AND submission_id IN (
    SELECT id FROM submissions WHERE submitter_id = current_user_id()
  )
);

--> statement-breakpoint
CREATE INDEX "reader_feedback_organization_id_idx" ON "reader_feedback" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "reader_feedback_submission_id_idx" ON "reader_feedback" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "reader_feedback_reviewer_user_id_idx" ON "reader_feedback" USING btree ("reviewer_user_id");
--> statement-breakpoint
CREATE INDEX "reader_feedback_org_submission_idx" ON "reader_feedback" USING btree ("organization_id", "submission_id");
--> statement-breakpoint
CREATE INDEX "reader_feedback_tags_gin_idx" ON "reader_feedback" USING gin ("tags" jsonb_path_ops);

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "simsub_groups" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "simsub_group_submissions" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "portfolio_entries" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "reader_feedback" TO app_user;
