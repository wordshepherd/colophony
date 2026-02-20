-- Form builder: form_definitions + form_fields tables
-- Also adds form_definition_id + form_data columns to submissions and submission_periods

-- Create FormStatus enum
CREATE TYPE "public"."FormStatus" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint

-- Create FormFieldType enum
CREATE TYPE "public"."FormFieldType" AS ENUM('text', 'textarea', 'rich_text', 'number', 'email', 'url', 'date', 'select', 'multi_select', 'radio', 'checkbox', 'checkbox_group', 'file_upload', 'section_header', 'info_text');--> statement-breakpoint

-- Create form_definitions table
CREATE TABLE "form_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" "FormStatus" DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"duplicated_from_id" uuid,
	"created_by" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "form_definitions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Create form_fields table
CREATE TABLE "form_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"form_definition_id" uuid NOT NULL,
	"field_key" varchar(100) NOT NULL,
	"field_type" "FormFieldType" NOT NULL,
	"label" varchar(500) NOT NULL,
	"description" text,
	"placeholder" varchar(500),
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"conditional_rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "form_fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Add form_definition_id to submission_periods
ALTER TABLE "submission_periods" ADD COLUMN "form_definition_id" uuid;--> statement-breakpoint

-- Add form_definition_id and form_data to submissions
ALTER TABLE "submissions" ADD COLUMN "form_definition_id" uuid;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "form_data" jsonb;--> statement-breakpoint

-- Foreign keys for form_definitions
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

-- Foreign keys for form_fields
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_definition_id_form_definitions_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Foreign keys for submission_periods.form_definition_id
ALTER TABLE "submission_periods" ADD CONSTRAINT "submission_periods_form_definition_id_form_definitions_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Foreign keys for submissions.form_definition_id
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_form_definition_id_form_definitions_id_fk" FOREIGN KEY ("form_definition_id") REFERENCES "public"."form_definitions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Indexes for form_definitions
CREATE INDEX "form_definitions_organization_id_idx" ON "form_definitions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "form_definitions_org_status_idx" ON "form_definitions" USING btree ("organization_id", "status");--> statement-breakpoint

-- Indexes for form_fields
CREATE INDEX "form_fields_form_definition_id_idx" ON "form_fields" USING btree ("form_definition_id");--> statement-breakpoint
CREATE INDEX "form_fields_form_sort_idx" ON "form_fields" USING btree ("form_definition_id", "sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "form_fields_form_field_key_idx" ON "form_fields" USING btree ("form_definition_id", "field_key");--> statement-breakpoint

-- Indexes for new columns on existing tables
CREATE INDEX "submission_periods_form_definition_id_idx" ON "submission_periods" USING btree ("form_definition_id");--> statement-breakpoint
CREATE INDEX "submissions_form_definition_id_idx" ON "submissions" USING btree ("form_definition_id");--> statement-breakpoint

-- RLS policies for form_definitions
CREATE POLICY "form_definitions_org_isolation" ON "form_definitions" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());--> statement-breakpoint

-- RLS policies for form_fields (subquery through form_definitions)
CREATE POLICY "form_fields_org_isolation" ON "form_fields" AS PERMISSIVE FOR ALL TO public USING (form_definition_id IN (
  SELECT id FROM form_definitions
  WHERE organization_id = current_org_id()
));--> statement-breakpoint

-- FORCE ROW LEVEL SECURITY (Drizzle only generates ENABLE, not FORCE)
ALTER TABLE "form_definitions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "form_fields" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Grant DML permissions to app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_definitions" TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "form_fields" TO app_user;
