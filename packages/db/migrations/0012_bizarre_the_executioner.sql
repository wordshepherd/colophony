-- Form branching: form_pages table + branch_id/page_id columns on form_fields

-- Create form_pages table
CREATE TABLE "form_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_definition_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"branching_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "form_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_pages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Add FK from form_pages to form_definitions
ALTER TABLE "form_pages" ADD CONSTRAINT "form_pages_form_definition_id_form_definitions_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Indexes on form_pages
CREATE INDEX "form_pages_form_definition_id_idx" ON "form_pages" USING btree ("form_definition_id");--> statement-breakpoint
CREATE INDEX "form_pages_form_sort_idx" ON "form_pages" USING btree ("form_definition_id","sort_order");--> statement-breakpoint

-- RLS policy on form_pages
CREATE POLICY "form_pages_org_isolation" ON "form_pages" AS PERMISSIVE FOR ALL TO public USING (form_definition_id IN (
        SELECT id FROM form_definitions
        WHERE organization_id = current_org_id()
      ));--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_pages" TO app_user;--> statement-breakpoint

-- Add branch_id and page_id columns to form_fields
ALTER TABLE "form_fields" ADD COLUMN "branch_id" varchar(36);--> statement-breakpoint
ALTER TABLE "form_fields" ADD COLUMN "page_id" uuid;--> statement-breakpoint

-- FK from form_fields.page_id to form_pages
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_page_id_form_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."form_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Index on form_fields.branch_id
CREATE INDEX "form_fields_branch_id_idx" ON "form_fields" USING btree ("branch_id");
