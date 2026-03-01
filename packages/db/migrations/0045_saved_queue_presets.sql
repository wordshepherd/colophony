CREATE TABLE "saved_queue_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"filters" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_queue_presets" ADD CONSTRAINT "saved_queue_presets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saved_queue_presets" ADD CONSTRAINT "saved_queue_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "saved_queue_presets_org_user_name_idx" ON "saved_queue_presets" USING btree ("organization_id","user_id","name");
--> statement-breakpoint
CREATE INDEX "saved_queue_presets_org_user_idx" ON "saved_queue_presets" USING btree ("organization_id","user_id");
--> statement-breakpoint
ALTER TABLE "saved_queue_presets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "saved_queue_presets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "saved_queue_presets" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());
