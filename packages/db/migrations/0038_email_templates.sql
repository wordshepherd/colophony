-- Email Templates — per-org customizable email template overrides
-- Manual migration (drizzle-kit TUI blocked in non-interactive shell)

--> statement-breakpoint
CREATE TABLE "email_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "template_name" varchar(64) NOT NULL,
  "subject_template" varchar(512) NOT NULL,
  "body_html" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_org_name_idx" ON "email_templates" ("organization_id", "template_name");

--> statement-breakpoint
CREATE INDEX "email_templates_organization_id_idx" ON "email_templates" ("organization_id");

--> statement-breakpoint
ALTER TABLE "email_templates" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "email_templates" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "email_templates_select" ON "email_templates"
  FOR SELECT
  USING (organization_id = current_org_id());

--> statement-breakpoint
CREATE POLICY "email_templates_modify" ON "email_templates"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint
GRANT ALL ON "email_templates" TO "app_user";

--> statement-breakpoint
CREATE TRIGGER email_templates_updated_at
  BEFORE UPDATE ON "email_templates"
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
