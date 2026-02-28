-- submission_discussions: internal staff discussion threads on submissions
CREATE TABLE IF NOT EXISTS "submission_discussions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "submission_id" uuid NOT NULL REFERENCES "submissions"("id") ON DELETE CASCADE,
  "author_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "parent_id" uuid REFERENCES "submission_discussions"("id") ON DELETE SET NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone
);

--> statement-breakpoint

ALTER TABLE "submission_discussions" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

CREATE POLICY "org_isolation" ON "submission_discussions" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submission_discussions_org_id_idx" ON "submission_discussions" USING btree ("organization_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submission_discussions_submission_id_idx" ON "submission_discussions" USING btree ("submission_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submission_discussions_parent_id_idx" ON "submission_discussions" USING btree ("parent_id");

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "submission_discussions_author_id_idx" ON "submission_discussions" USING btree ("author_id");
