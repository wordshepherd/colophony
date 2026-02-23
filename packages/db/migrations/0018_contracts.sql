-- 0018: Contract tables — contract_templates, contracts

-- Create ContractStatus enum
CREATE TYPE "ContractStatus" AS ENUM (
  'DRAFT',
  'SENT',
  'VIEWED',
  'SIGNED',
  'COUNTERSIGNED',
  'COMPLETED',
  'VOIDED'
);

--> statement-breakpoint

-- Create contract_templates table
CREATE TABLE "contract_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "body" text NOT NULL,
  "merge_fields" jsonb,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Create contracts table
CREATE TABLE "contracts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "pipeline_item_id" uuid NOT NULL,
  "contract_template_id" uuid,
  "status" "ContractStatus" DEFAULT 'DRAFT' NOT NULL,
  "rendered_body" text NOT NULL,
  "merge_data" jsonb,
  "documenso_document_id" varchar(255),
  "signed_at" timestamp with time zone,
  "countersigned_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint

-- Foreign keys: contract_templates
ALTER TABLE "contract_templates"
  ADD CONSTRAINT "contract_templates_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

-- Foreign keys: contracts
ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_pipeline_item_id_pipeline_items_id_fk"
  FOREIGN KEY ("pipeline_item_id") REFERENCES "pipeline_items" ("id")
  ON DELETE CASCADE;

--> statement-breakpoint

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_contract_template_id_contract_templates_id_fk"
  FOREIGN KEY ("contract_template_id") REFERENCES "contract_templates" ("id")
  ON DELETE SET NULL;

--> statement-breakpoint

-- Indexes: contract_templates
CREATE INDEX "contract_templates_organization_id_idx" ON "contract_templates" USING btree ("organization_id");

--> statement-breakpoint

-- Indexes: contracts
CREATE INDEX "contracts_organization_id_idx" ON "contracts" USING btree ("organization_id");
CREATE INDEX "contracts_pipeline_item_id_idx" ON "contracts" USING btree ("pipeline_item_id");
CREATE INDEX "contracts_org_status_idx" ON "contracts" USING btree ("organization_id", "status");
CREATE INDEX "contracts_documenso_id_idx" ON "contracts" USING btree ("documenso_document_id");

--> statement-breakpoint

-- Enable RLS + FORCE on both tables
ALTER TABLE "contract_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contract_templates" FORCE ROW LEVEL SECURITY;
ALTER TABLE "contracts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contracts" FORCE ROW LEVEL SECURITY;

--> statement-breakpoint

-- RLS policies: org isolation
CREATE POLICY "org_isolation" ON "contract_templates"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

CREATE POLICY "org_isolation" ON "contracts"
  FOR ALL
  USING (organization_id = current_org_id())
  WITH CHECK (organization_id = current_org_id());

--> statement-breakpoint

-- GRANTs for app_user
GRANT SELECT, INSERT, UPDATE, DELETE ON "contract_templates" TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "contracts" TO app_user;

--> statement-breakpoint

-- updatedAt trigger
CREATE TRIGGER "trg_contract_templates_set_updated_at"
  BEFORE UPDATE ON "contract_templates"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER "trg_contracts_set_updated_at"
  BEFORE UPDATE ON "contracts"
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
