-- Contest Management
-- New enum: ContestJudgeRole
-- New tables: contest_groups, contest_judges, contest_results
-- New columns on submission_periods: contest_group_id, contest_round

--> statement-breakpoint
CREATE TYPE "public"."ContestJudgeRole" AS ENUM('head_judge', 'judge', 'screener');

--> statement-breakpoint
CREATE TABLE "contest_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "total_rounds_planned" integer,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "contest_groups_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "contest_groups" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contest_groups" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "org_isolation" ON "contest_groups" AS PERMISSIVE FOR ALL USING (organization_id = current_org_id());

--> statement-breakpoint
CREATE INDEX "contest_groups_organization_id_idx" ON "contest_groups" USING btree ("organization_id");

--> statement-breakpoint
CREATE TABLE "contest_judges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_period_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" "ContestJudgeRole" NOT NULL DEFAULT 'judge',
  "assigned_by" uuid,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  "notes" text,
  CONSTRAINT "contest_judges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_judges_submission_period_id_submission_periods_id_fk" FOREIGN KEY ("submission_period_id") REFERENCES "public"."submission_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_judges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_judges_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "contest_judges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contest_judges" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "org_isolation" ON "contest_judges" AS PERMISSIVE FOR ALL USING (organization_id = current_org_id());

--> statement-breakpoint
CREATE INDEX "contest_judges_organization_id_idx" ON "contest_judges" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "contest_judges_submission_period_id_idx" ON "contest_judges" USING btree ("submission_period_id");
--> statement-breakpoint
CREATE INDEX "contest_judges_user_id_idx" ON "contest_judges" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "contest_judges_period_user_idx" ON "contest_judges" USING btree ("submission_period_id", "user_id");

--> statement-breakpoint
CREATE TABLE "contest_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "submission_period_id" uuid NOT NULL,
  "submission_id" uuid NOT NULL,
  "placement" integer,
  "category" varchar(255),
  "prize_amount" integer,
  "prize_currency" varchar(3) NOT NULL DEFAULT 'usd',
  "disbursement_id" uuid,
  "announced_at" timestamptz,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "contest_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_results_submission_period_id_submission_periods_id_fk" FOREIGN KEY ("submission_period_id") REFERENCES "public"."submission_periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_results_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "contest_results_disbursement_id_payment_transactions_id_fk" FOREIGN KEY ("disbursement_id") REFERENCES "public"."payment_transactions"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

--> statement-breakpoint
ALTER TABLE "contest_results" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contest_results" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "org_isolation" ON "contest_results" AS PERMISSIVE FOR ALL USING (organization_id = current_org_id());

--> statement-breakpoint
CREATE INDEX "contest_results_organization_id_idx" ON "contest_results" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "contest_results_submission_period_id_idx" ON "contest_results" USING btree ("submission_period_id");
--> statement-breakpoint
CREATE INDEX "contest_results_submission_id_idx" ON "contest_results" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "contest_results_disbursement_id_idx" ON "contest_results" USING btree ("disbursement_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "contest_results_period_submission_idx" ON "contest_results" USING btree ("submission_period_id", "submission_id");

--> statement-breakpoint
ALTER TABLE "submission_periods" ADD COLUMN "contest_group_id" uuid;
--> statement-breakpoint
ALTER TABLE "submission_periods" ADD COLUMN "contest_round" integer;

--> statement-breakpoint
ALTER TABLE "submission_periods" ADD CONSTRAINT "submission_periods_contest_group_id_contest_groups_id_fk" FOREIGN KEY ("contest_group_id") REFERENCES "public"."contest_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

--> statement-breakpoint
CREATE INDEX "submission_periods_contest_group_id_idx" ON "submission_periods" USING btree ("contest_group_id");

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contest_groups" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contest_judges" TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contest_results" TO app_user;
