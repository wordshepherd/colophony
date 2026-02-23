-- 0017: Pipeline tables — pipeline_items, pipeline_history, pipeline_comments

-- Create PipelineStage enum
CREATE TYPE "PipelineStage" AS ENUM (
  'COPYEDIT_PENDING',
  'COPYEDIT_IN_PROGRESS',
  'AUTHOR_REVIEW',
  'PROOFREAD',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'WITHDRAWN'
);

--> statement-breakpoint

-- Create pipeline_items table
CREATE TABLE "pipeline_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "publication_id" uuid,
  "stage" "PipelineStage" DEFAULT 'COPYEDIT_PENDING' NOT NULL,
  "assigned_copyeditor_id" uuid,
  "assigned_proofreader_id" uuid,
  "copyedit_due_at" timestamp with time zone,
  "proofread_due_at" timestamp with time zone,
  "author_review_due_at" timestamp with time zone,
  "inngest_run_id" varchar(255),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys for pipeline_items
ALTER TABLE "pipeline_items"
  ADD CONSTRAINT "pipeline_items_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "pipeline_items"
  ADD CONSTRAINT "pipeline_items_submission_id_submissions_id_fk"
  FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "pipeline_items"
  ADD CONSTRAINT "pipeline_items_publication_id_publications_id_fk"
  FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "pipeline_items"
  ADD CONSTRAINT "pipeline_items_assigned_copyeditor_id_users_id_fk"
  FOREIGN KEY ("assigned_copyeditor_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "pipeline_items"
  ADD CONSTRAINT "pipeline_items_assigned_proofreader_id_users_id_fk"
  FOREIGN KEY ("assigned_proofreader_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint

-- Indexes for pipeline_items
CREATE INDEX "pipeline_items_organization_id_idx" ON "pipeline_items" USING btree ("organization_id");
CREATE UNIQUE INDEX "pipeline_items_submission_id_idx" ON "pipeline_items" USING btree ("submission_id");
CREATE INDEX "pipeline_items_publication_id_idx" ON "pipeline_items" USING btree ("publication_id");
CREATE INDEX "pipeline_items_org_stage_idx" ON "pipeline_items" USING btree ("organization_id", "stage");
CREATE INDEX "pipeline_items_copyeditor_idx" ON "pipeline_items" USING btree ("assigned_copyeditor_id");
CREATE INDEX "pipeline_items_proofreader_idx" ON "pipeline_items" USING btree ("assigned_proofreader_id");

--> statement-breakpoint

-- Enable + FORCE RLS on pipeline_items
ALTER TABLE "pipeline_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_items" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy: org isolation for pipeline_items
CREATE POLICY "org_isolation" ON "pipeline_items"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "pipeline_items" TO app_user;

--> statement-breakpoint

-- Create pipeline_history table
CREATE TABLE "pipeline_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pipeline_item_id" uuid NOT NULL,
  "from_stage" "PipelineStage",
  "to_stage" "PipelineStage" NOT NULL,
  "changed_by" uuid,
  "comment" text,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys for pipeline_history
ALTER TABLE "pipeline_history"
  ADD CONSTRAINT "pipeline_history_pipeline_item_id_pipeline_items_id_fk"
  FOREIGN KEY ("pipeline_item_id") REFERENCES "pipeline_items"("id") ON DELETE cascade ON UPDATE no action;

--> statement-breakpoint

-- Indexes for pipeline_history
CREATE INDEX "pipeline_history_item_id_idx" ON "pipeline_history" USING btree ("pipeline_item_id");
CREATE INDEX "pipeline_history_changed_at_idx" ON "pipeline_history" USING btree ("pipeline_item_id", "changed_at");

--> statement-breakpoint

-- Enable + FORCE RLS on pipeline_history
ALTER TABLE "pipeline_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_history" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy: org isolation via parent for pipeline_history
CREATE POLICY "pipeline_history_org_isolation" ON "pipeline_history"
  FOR ALL
  USING (pipeline_item_id IN (
    SELECT id FROM pipeline_items
    WHERE organization_id = current_org_id()
  ))
  WITH CHECK (pipeline_item_id IN (
    SELECT id FROM pipeline_items
    WHERE organization_id = current_org_id()
  ));

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "pipeline_history" TO app_user;

--> statement-breakpoint

-- Create pipeline_comments table
CREATE TABLE "pipeline_comments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pipeline_item_id" uuid NOT NULL,
  "author_id" uuid,
  "content" text NOT NULL,
  "stage" "PipelineStage" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys for pipeline_comments
ALTER TABLE "pipeline_comments"
  ADD CONSTRAINT "pipeline_comments_pipeline_item_id_pipeline_items_id_fk"
  FOREIGN KEY ("pipeline_item_id") REFERENCES "pipeline_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "pipeline_comments"
  ADD CONSTRAINT "pipeline_comments_author_id_users_id_fk"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;

--> statement-breakpoint

-- Indexes for pipeline_comments
CREATE INDEX "pipeline_comments_item_id_idx" ON "pipeline_comments" USING btree ("pipeline_item_id");

--> statement-breakpoint

-- Enable + FORCE RLS on pipeline_comments
ALTER TABLE "pipeline_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pipeline_comments" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy: org isolation via parent for pipeline_comments
CREATE POLICY "pipeline_comments_org_isolation" ON "pipeline_comments"
  FOR ALL
  USING (pipeline_item_id IN (
    SELECT id FROM pipeline_items
    WHERE organization_id = current_org_id()
  ))
  WITH CHECK (pipeline_item_id IN (
    SELECT id FROM pipeline_items
    WHERE organization_id = current_org_id()
  ));

--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "pipeline_comments" TO app_user;

--> statement-breakpoint

-- updatedAt trigger for pipeline_items (reuses the existing trigger function from 0002)
CREATE TRIGGER "trg_pipeline_items_set_updated_at"
  BEFORE UPDATE ON "pipeline_items"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
