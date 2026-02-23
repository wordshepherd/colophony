-- GDPR user deletion + organization deletion FK constraint changes
-- Changes RESTRICT → SET NULL or CASCADE to allow user/org deletion

-- audit_events: allow org + user deletion (SET NULL preserves audit rows)
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
ALTER TABLE "audit_events" DROP CONSTRAINT "audit_events_actor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk"
  FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- dsar_requests: cascade on user deletion
ALTER TABLE "dsar_requests" DROP CONSTRAINT "dsar_requests_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- submissions: submitter_id SET NULL + make nullable
ALTER TABLE "submissions" DROP CONSTRAINT "submissions_submitter_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "submitter_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitter_id_users_id_fk"
  FOREIGN KEY ("submitter_id") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- manuscripts: cascade on user deletion (deletes manuscripts → versions → files)
ALTER TABLE "manuscripts" DROP CONSTRAINT "manuscripts_owner_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_owner_id_users_id_fk"
  FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

-- api_keys: created_by SET NULL + make nullable
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "api_keys" ALTER COLUMN "created_by" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- form_definitions: created_by SET NULL + make nullable
ALTER TABLE "form_definitions" DROP CONSTRAINT "form_definitions_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "form_definitions" ALTER COLUMN "created_by" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- embed_tokens: created_by SET NULL + make nullable
ALTER TABLE "embed_tokens" DROP CONSTRAINT "embed_tokens_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "embed_tokens" ALTER COLUMN "created_by" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "embed_tokens" ADD CONSTRAINT "embed_tokens_created_by_users_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

-- payments: organization_id SET NULL + make nullable
ALTER TABLE "payments" DROP CONSTRAINT "payments_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "organization_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
