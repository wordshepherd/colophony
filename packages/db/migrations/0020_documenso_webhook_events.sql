-- 0020: Documenso webhook events (system table, no RLS)

CREATE TABLE IF NOT EXISTS "documenso_webhook_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "documenso_id" varchar(255) NOT NULL UNIQUE,
  "type" varchar(255) NOT NULL,
  "payload" jsonb NOT NULL,
  "processed" boolean NOT NULL DEFAULT false,
  "processed_at" timestamptz,
  "error" text,
  "received_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

-- Polling index for unprocessed events
CREATE INDEX IF NOT EXISTS "documenso_webhook_events_polling_idx"
  ON "documenso_webhook_events" ("processed_at", "received_at");

--> statement-breakpoint

-- GRANT to app_user (system table accessed by webhook handler via pool)
GRANT SELECT, INSERT, UPDATE ON "documenso_webhook_events" TO "app_user";
