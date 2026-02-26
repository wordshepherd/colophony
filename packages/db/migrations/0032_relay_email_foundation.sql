-- Relay Email Foundation — notification preferences + email send tracking
-- Manual migration (drizzle-kit TUI blocked in non-interactive shell)

--> statement-breakpoint
CREATE TYPE "public"."EmailSendStatus" AS ENUM('QUEUED', 'SENDING', 'SENT', 'FAILED', 'BOUNCED');

--> statement-breakpoint
CREATE TYPE "public"."NotificationChannel" AS ENUM('email');

--> statement-breakpoint
CREATE TABLE "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "channel" "NotificationChannel" NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_org_user_channel_event_idx"
  ON "notification_preferences" ("organization_id", "user_id", "channel", "event_type");

--> statement-breakpoint
ALTER TABLE "notification_preferences" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "notification_preferences" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "notification_preferences_org_isolation" ON "notification_preferences"
  FOR ALL
  USING (organization_id = current_setting('app.current_org')::uuid);

--> statement-breakpoint
GRANT ALL ON "notification_preferences" TO "app_user";

--> statement-breakpoint
CREATE TABLE "email_sends" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "recipient_user_id" uuid REFERENCES "users"("id"),
  "recipient_email" varchar(320) NOT NULL,
  "template_name" varchar(128) NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "subject" varchar(512) NOT NULL,
  "status" "EmailSendStatus" DEFAULT 'QUEUED' NOT NULL,
  "provider_message_id" varchar(255),
  "error_message" varchar(2048),
  "attempts" integer DEFAULT 0 NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX "email_sends_org_idx" ON "email_sends" ("organization_id");

--> statement-breakpoint
CREATE INDEX "email_sends_recipient_idx" ON "email_sends" ("recipient_user_id");

--> statement-breakpoint
CREATE INDEX "email_sends_status_created_idx" ON "email_sends" ("status", "created_at");

--> statement-breakpoint
CREATE INDEX "email_sends_event_type_created_idx" ON "email_sends" ("event_type", "created_at");

--> statement-breakpoint
ALTER TABLE "email_sends" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "email_sends" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "email_sends_org_isolation" ON "email_sends"
  FOR ALL
  USING (organization_id = current_setting('app.current_org')::uuid);

--> statement-breakpoint
GRANT ALL ON "email_sends" TO "app_user";
