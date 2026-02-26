-- Relay Webhook Endpoints — outbound webhook delivery system
-- Manual migration (drizzle-kit TUI blocked in non-interactive shell)

--> statement-breakpoint
CREATE TYPE "public"."WebhookEndpointStatus" AS ENUM('ACTIVE', 'DISABLED');

--> statement-breakpoint
CREATE TYPE "public"."WebhookDeliveryStatus" AS ENUM('QUEUED', 'DELIVERING', 'DELIVERED', 'FAILED');

--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "url" varchar(2048) NOT NULL,
  "secret" varchar(512) NOT NULL,
  "description" varchar(512),
  "event_types" jsonb NOT NULL,
  "status" "WebhookEndpointStatus" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX "webhook_endpoints_org_idx" ON "webhook_endpoints" ("organization_id");

--> statement-breakpoint
CREATE INDEX "webhook_endpoints_status_idx" ON "webhook_endpoints" ("status");

--> statement-breakpoint
ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "webhook_endpoints_org_isolation" ON "webhook_endpoints"
  FOR ALL
  USING (organization_id = current_setting('app.current_org')::uuid);

--> statement-breakpoint
GRANT ALL ON "webhook_endpoints" TO "app_user";

--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "webhook_endpoint_id" uuid NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
  "event_type" varchar(128) NOT NULL,
  "event_id" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "WebhookDeliveryStatus" DEFAULT 'QUEUED' NOT NULL,
  "http_status_code" integer,
  "response_body" varchar(4096),
  "error_message" varchar(2048),
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE INDEX "webhook_deliveries_endpoint_created_idx" ON "webhook_deliveries" ("webhook_endpoint_id", "created_at");

--> statement-breakpoint
CREATE INDEX "webhook_deliveries_status_created_idx" ON "webhook_deliveries" ("status", "created_at");

--> statement-breakpoint
CREATE INDEX "webhook_deliveries_event_type_created_idx" ON "webhook_deliveries" ("event_type", "created_at");

--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "webhook_deliveries" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "webhook_deliveries_org_isolation" ON "webhook_deliveries"
  FOR ALL
  USING (organization_id = current_setting('app.current_org')::uuid);

--> statement-breakpoint
GRANT ALL ON "webhook_deliveries" TO "app_user";
