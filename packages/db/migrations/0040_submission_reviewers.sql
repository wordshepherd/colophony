CREATE TABLE IF NOT EXISTS "submission_reviewers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "reviewer_user_id" uuid NOT NULL,
  "assigned_by" uuid,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "read_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "submission_reviewers" ADD CONSTRAINT "submission_reviewers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "submission_reviewers" ADD CONSTRAINT "submission_reviewers_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "submission_reviewers" ADD CONSTRAINT "submission_reviewers_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "submission_reviewers" ADD CONSTRAINT "submission_reviewers_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "submission_reviewers_sub_user_idx" ON "submission_reviewers" ("submission_id", "reviewer_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_reviewers_org_id_idx" ON "submission_reviewers" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_reviewers_submission_id_idx" ON "submission_reviewers" ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_reviewers_reviewer_user_id_idx" ON "submission_reviewers" ("reviewer_user_id");
--> statement-breakpoint
ALTER TABLE "submission_reviewers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "submission_reviewers" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "submission_reviewers" FOR ALL USING (organization_id = current_org_id());
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "submission_reviewers" TO app_user;
