-- Step 4: Workspace Collections (editor desk management)
-- Hand-written: Drizzle only generates ENABLE RLS, not FORCE

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."CollectionVisibility" AS ENUM('private', 'team', 'collaborators');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."CollectionTypeHint" AS ENUM('holds', 'reading_list', 'comparison', 'issue_planning', 'custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_collections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "owner_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "visibility" "CollectionVisibility" DEFAULT 'private' NOT NULL,
  "type_hint" "CollectionTypeHint" DEFAULT 'custom' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspace_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "collection_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "notes" text,
  "color" varchar(50),
  "icon" varchar(50),
  "reading_anchor" jsonb,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  "touched_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_collections" ADD CONSTRAINT "workspace_collections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_collections" ADD CONSTRAINT "workspace_collections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_collection_id_workspace_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."workspace_collections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_collections_org_id_idx" ON "workspace_collections" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_collections_owner_idx" ON "workspace_collections" USING btree ("organization_id", "owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_items_collection_id_idx" ON "workspace_items" USING btree ("collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_items_submission_id_idx" ON "workspace_items" USING btree ("submission_id");
--> statement-breakpoint
ALTER TABLE "workspace_items" ADD CONSTRAINT "workspace_items_collection_submission_unique" UNIQUE("collection_id", "submission_id");

--> statement-breakpoint
ALTER TABLE "workspace_collections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_collections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspace_collections_org_isolation" ON "workspace_collections" FOR ALL USING (organization_id = current_org_id());

--> statement-breakpoint
ALTER TABLE "workspace_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspace_items_org_isolation" ON "workspace_items" FOR ALL USING (EXISTS (SELECT 1 FROM workspace_collections wc WHERE wc.id = collection_id AND wc.organization_id = current_org_id()));

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_collections" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "workspace_items" TO app_user;
