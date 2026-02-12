CREATE TYPE "public"."DsarStatus" AS ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."DsarType" AS ENUM('ACCESS', 'ERASURE', 'RECTIFICATION', 'PORTABILITY');--> statement-breakpoint
CREATE TYPE "public"."PaymentStatus" AS ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."Role" AS ENUM('ADMIN', 'EDITOR', 'READER');--> statement-breakpoint
CREATE TYPE "public"."ScanStatus" AS ENUM('PENDING', 'SCANNING', 'CLEAN', 'INFECTED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."SubmissionStatus" AS ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'HOLD', 'WITHDRAWN');--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"actor_id" uuid,
	"action" varchar(255) NOT NULL,
	"resource" varchar(255) NOT NULL,
	"resource_id" uuid,
	"old_value" text,
	"new_value" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "DsarType" NOT NULL,
	"status" "DsarStatus" DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"resource" varchar(255) NOT NULL,
	"retention_days" integer NOT NULL,
	"condition" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "retention_policies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid,
	"consent_type" varchar(100) NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" varchar(45)
);
--> statement-breakpoint
ALTER TABLE "user_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"zitadel_user_id" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "Role" DEFAULT 'READER' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"filename" varchar(500) NOT NULL,
	"mime_type" varchar(255) NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" varchar(1000) NOT NULL,
	"scan_status" "ScanStatus" DEFAULT 'PENDING' NOT NULL,
	"scanned_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submission_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"from_status" "SubmissionStatus",
	"to_status" "SubmissionStatus" NOT NULL,
	"changed_by" uuid,
	"comment" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submission_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"fee" numeric(10, 2),
	"max_submissions" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_periods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submitter_id" uuid NOT NULL,
	"submission_period_id" uuid,
	"title" varchar(500),
	"content" text,
	"cover_letter" text,
	"status" "SubmissionStatus" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector"
);
--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submission_id" uuid,
	"stripe_payment_id" varchar(255),
	"stripe_session_id" varchar(255),
	"amount" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"status" "PaymentStatus" DEFAULT 'PENDING' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_stripe_payment_id_unique" UNIQUE("stripe_payment_id"),
	CONSTRAINT "payments_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_webhook_events_stripe_id_unique" UNIQUE("stripe_id")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zitadel_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_history" ADD CONSTRAINT "submission_history_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_periods" ADD CONSTRAINT "submission_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_users_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submission_period_id_submission_periods_id_fk" FOREIGN KEY ("submission_period_id") REFERENCES "public"."submission_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_organization_id_idx" ON "audit_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_id_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_created_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_org_created_idx" ON "audit_events" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "dsar_requests_user_id_idx" ON "dsar_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "dsar_requests_status_due_idx" ON "dsar_requests" USING btree ("status","due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "retention_policies_org_resource_idx" ON "retention_policies" USING btree ("organization_id","resource");--> statement-breakpoint
CREATE INDEX "retention_policies_organization_id_idx" ON "retention_policies" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_consents_user_id_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_consents_organization_id_idx" ON "user_consents" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "user_consents_user_consent_type_idx" ON "user_consents" USING btree ("user_id","consent_type");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_lower_slug_idx" ON "organizations" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "organizations_settings_gin_idx" ON "organizations" USING gin ("settings" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "users_lower_email_idx" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_zitadel_user_id_idx" ON "users" USING btree ("zitadel_user_id") WHERE "users"."zitadel_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_idx" ON "organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_members_user_id_idx" ON "organization_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_files_scan_status_idx" ON "submission_files" USING btree ("submission_id","scan_status","uploaded_at");--> statement-breakpoint
CREATE INDEX "submission_history_submission_id_idx" ON "submission_history" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_history_changed_at_idx" ON "submission_history" USING btree ("submission_id","changed_at");--> statement-breakpoint
CREATE INDEX "submission_periods_organization_id_idx" ON "submission_periods" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "submission_periods_org_dates_idx" ON "submission_periods" USING btree ("organization_id","opens_at","closes_at");--> statement-breakpoint
CREATE INDEX "submissions_organization_id_idx" ON "submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "submissions_submitter_id_idx" ON "submissions" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "submissions_submission_period_id_idx" ON "submissions" USING btree ("submission_period_id");--> statement-breakpoint
CREATE INDEX "submissions_org_status_submitted_idx" ON "submissions" USING btree ("organization_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "submissions_search_vector_idx" ON "submissions" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "payments_organization_id_idx" ON "payments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payments_submission_id_idx" ON "payments" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "payments_metadata_gin_idx" ON "payments" USING gin ("metadata" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX "stripe_webhook_events_polling_idx" ON "stripe_webhook_events" USING btree ("processed_at","received_at");--> statement-breakpoint
CREATE INDEX "outbox_events_ready_idx" ON "outbox_events" USING btree ("processed_at","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "zitadel_webhook_events_event_id_idx" ON "zitadel_webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "zitadel_webhook_events_ready_idx" ON "zitadel_webhook_events" USING btree ("processed_at","received_at");--> statement-breakpoint
CREATE POLICY "audit_events_org_isolation" ON "audit_events" AS PERMISSIVE FOR ALL TO public USING (organization_id IS NULL OR organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "retention_policies_org_isolation" ON "retention_policies" AS PERMISSIVE FOR ALL TO public USING (organization_id IS NULL OR organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "user_consents_org_isolation" ON "user_consents" AS PERMISSIVE FOR ALL TO public USING (organization_id IS NULL OR organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "organization_members_select" ON "organization_members" AS PERMISSIVE FOR SELECT TO public USING (organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "organization_members_modify" ON "organization_members" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id()) WITH CHECK (organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "submission_files_org_isolation" ON "submission_files" AS PERMISSIVE FOR ALL TO public USING (submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      ));--> statement-breakpoint
CREATE POLICY "submission_history_org_isolation" ON "submission_history" AS PERMISSIVE FOR ALL TO public USING (submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      ));--> statement-breakpoint
CREATE POLICY "org_isolation" ON "submission_periods" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "org_isolation" ON "submissions" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());--> statement-breakpoint
CREATE POLICY "payments_org_isolation" ON "payments" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());