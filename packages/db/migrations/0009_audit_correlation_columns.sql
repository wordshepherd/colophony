ALTER TABLE "audit_events" ADD COLUMN "request_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "method" varchar(10);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "route" varchar(512);
