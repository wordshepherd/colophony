CREATE TYPE "public"."VoteDecision" AS ENUM('ACCEPT', 'REJECT', 'MAYBE');
--> statement-breakpoint
CREATE TABLE "submission_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"submission_id" uuid NOT NULL,
	"voter_user_id" uuid NOT NULL,
	"decision" "VoteDecision" NOT NULL,
	"score" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_votes" ADD CONSTRAINT "submission_votes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission_votes" ADD CONSTRAINT "submission_votes_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "submission_votes" ADD CONSTRAINT "submission_votes_voter_user_id_users_id_fk" FOREIGN KEY ("voter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "submission_votes_sub_voter_idx" ON "submission_votes" USING btree ("submission_id","voter_user_id");
--> statement-breakpoint
CREATE INDEX "submission_votes_org_id_idx" ON "submission_votes" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "submission_votes_submission_id_idx" ON "submission_votes" USING btree ("submission_id");
--> statement-breakpoint
CREATE INDEX "submission_votes_voter_user_id_idx" ON "submission_votes" USING btree ("voter_user_id");
--> statement-breakpoint
ALTER TABLE "submission_votes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "submission_votes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "org_isolation" ON "submission_votes" AS PERMISSIVE FOR ALL TO public USING (organization_id = current_org_id());
