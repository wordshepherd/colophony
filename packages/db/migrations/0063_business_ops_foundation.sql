-- Business Operations Foundation
-- New tables: contributors, contributor_publications, rights_agreements, payment_transactions

--> statement-breakpoint
CREATE TYPE "public"."ContributorPublicationRole" AS ENUM('author', 'translator', 'illustrator', 'photographer', 'editor');

--> statement-breakpoint
CREATE TYPE "public"."RightsType" AS ENUM('first_north_american_serial', 'electronic', 'anthology', 'audio', 'translation', 'custom');

--> statement-breakpoint
CREATE TYPE "public"."RightsAgreementStatus" AS ENUM('DRAFT', 'SENT', 'SIGNED', 'ACTIVE', 'REVERTED');

--> statement-breakpoint
CREATE TYPE "public"."PaymentTransactionType" AS ENUM('submission_fee', 'contest_fee', 'contributor_payment');

--> statement-breakpoint
CREATE TYPE "public"."PaymentTransactionDirection" AS ENUM('inbound', 'outbound');

--> statement-breakpoint
CREATE TABLE "contributors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "display_name" varchar(255) NOT NULL,
  "bio" text,
  "pronouns" varchar(100),
  "email" varchar(320),
  "website" varchar(2048),
  "mailing_address" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE "contributor_publications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contributor_id" uuid NOT NULL REFERENCES "contributors"("id") ON DELETE CASCADE,
  "pipeline_item_id" uuid NOT NULL REFERENCES "pipeline_items"("id") ON DELETE CASCADE,
  "role" "ContributorPublicationRole" NOT NULL DEFAULT 'author',
  "display_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE "rights_agreements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "contributor_id" uuid NOT NULL REFERENCES "contributors"("id") ON DELETE RESTRICT,
  "pipeline_item_id" uuid REFERENCES "pipeline_items"("id") ON DELETE SET NULL,
  "rights_type" "RightsType" NOT NULL,
  "custom_description" text,
  "status" "RightsAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "granted_at" timestamptz,
  "expires_at" timestamptz,
  "reverted_at" timestamptz,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE TABLE "payment_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "contributor_id" uuid REFERENCES "contributors"("id") ON DELETE SET NULL,
  "submission_id" uuid REFERENCES "submissions"("id") ON DELETE SET NULL,
  "payment_id" uuid REFERENCES "payments"("id") ON DELETE SET NULL,
  "type" "PaymentTransactionType" NOT NULL,
  "direction" "PaymentTransactionDirection" NOT NULL,
  "amount" integer NOT NULL,
  "currency" varchar(3) NOT NULL DEFAULT 'usd',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "description" text,
  "metadata" jsonb DEFAULT '{}',
  "processed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
CREATE INDEX "contributors_organization_id_idx" ON "contributors" ("organization_id");

--> statement-breakpoint
CREATE INDEX "contributors_user_id_idx" ON "contributors" ("user_id");

--> statement-breakpoint
CREATE INDEX "contributors_org_name_idx" ON "contributors" ("organization_id", "display_name");

--> statement-breakpoint
CREATE INDEX "contributor_publications_contributor_id_idx" ON "contributor_publications" ("contributor_id");

--> statement-breakpoint
CREATE INDEX "contributor_publications_pipeline_item_id_idx" ON "contributor_publications" ("pipeline_item_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "contributor_publications_contributor_item_role_idx" ON "contributor_publications" ("contributor_id", "pipeline_item_id", "role");

--> statement-breakpoint
CREATE INDEX "rights_agreements_organization_id_idx" ON "rights_agreements" ("organization_id");

--> statement-breakpoint
CREATE INDEX "rights_agreements_contributor_id_idx" ON "rights_agreements" ("contributor_id");

--> statement-breakpoint
CREATE INDEX "rights_agreements_pipeline_item_id_idx" ON "rights_agreements" ("pipeline_item_id");

--> statement-breakpoint
CREATE INDEX "rights_agreements_org_status_idx" ON "rights_agreements" ("organization_id", "status");

--> statement-breakpoint
CREATE INDEX "rights_agreements_org_expires_idx" ON "rights_agreements" ("organization_id", "expires_at");

--> statement-breakpoint
CREATE INDEX "payment_transactions_organization_id_idx" ON "payment_transactions" ("organization_id");

--> statement-breakpoint
CREATE INDEX "payment_transactions_contributor_id_idx" ON "payment_transactions" ("contributor_id");

--> statement-breakpoint
CREATE INDEX "payment_transactions_submission_id_idx" ON "payment_transactions" ("submission_id");

--> statement-breakpoint
CREATE INDEX "payment_transactions_payment_id_idx" ON "payment_transactions" ("payment_id");

--> statement-breakpoint
CREATE INDEX "payment_transactions_org_type_idx" ON "payment_transactions" ("organization_id", "type");

--> statement-breakpoint
CREATE INDEX "payment_transactions_org_status_idx" ON "payment_transactions" ("organization_id", "status");

--> statement-breakpoint
CREATE INDEX "payment_transactions_metadata_gin_idx" ON "payment_transactions" USING gin ("metadata" jsonb_path_ops);

--> statement-breakpoint
ALTER TABLE "contributors" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "contributors" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "contributor_publications" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "contributor_publications" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "rights_agreements" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "rights_agreements" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "payment_transactions" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE "payment_transactions" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY "contributors_org_isolation"
  ON "contributors"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint
CREATE POLICY "contributor_publications_org_isolation"
  ON "contributor_publications"
  FOR ALL
  USING (contributor_id IN (
    SELECT id FROM contributors
    WHERE organization_id = current_org_id()
  ))
  WITH CHECK (contributor_id IN (
    SELECT id FROM contributors
    WHERE organization_id = current_org_id()
  ));

--> statement-breakpoint
CREATE POLICY "rights_agreements_org_isolation"
  ON "rights_agreements"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint
CREATE POLICY "payment_transactions_org_isolation"
  ON "payment_transactions"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contributors" TO app_user;

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "contributor_publications" TO app_user;

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "rights_agreements" TO app_user;

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "payment_transactions" TO app_user;
