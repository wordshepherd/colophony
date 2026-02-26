-- Add 'in_app' to NotificationChannel enum
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'in_app';

--> statement-breakpoint

-- Create notifications_inbox table
CREATE TABLE IF NOT EXISTS "notifications_inbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "event_type" varchar(128) NOT NULL,
  "title" varchar(256) NOT NULL,
  "body" text,
  "link" varchar(2048),
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign key
ALTER TABLE "notifications_inbox"
  ADD CONSTRAINT "notifications_inbox_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

--> statement-breakpoint

-- Indexes
CREATE INDEX IF NOT EXISTS "notifications_inbox_user_unread_idx"
  ON "notifications_inbox" ("organization_id", "user_id", "read_at", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_inbox_user_created_idx"
  ON "notifications_inbox" ("user_id", "created_at");

--> statement-breakpoint

-- Enable RLS
ALTER TABLE "notifications_inbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications_inbox" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policy
CREATE POLICY "notifications_inbox_org_isolation"
  ON "notifications_inbox" AS PERMISSIVE
  FOR ALL
  TO public
  USING (organization_id = current_setting('app.current_org')::uuid);

--> statement-breakpoint

-- Grant permissions to app_user
GRANT ALL ON "notifications_inbox" TO app_user;
