import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contractStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { pipelineItems } from "./pipeline";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- contract_templates ---

export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    body: text("body").notNull(),
    mergeFields: jsonb("merge_fields").$type<
      Array<{
        key: string;
        label: string;
        source: "auto" | "manual";
        defaultValue?: string;
      }>
    >(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contract_templates_organization_id_idx").on(table.organizationId),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- contracts ---

export const contracts = pgTable(
  "contracts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    pipelineItemId: uuid("pipeline_item_id")
      .notNull()
      .references(() => pipelineItems.id, { onDelete: "cascade" }),
    contractTemplateId: uuid("contract_template_id").references(
      () => contractTemplates.id,
      { onDelete: "set null" },
    ),
    status: contractStatusEnum("status").notNull().default("DRAFT"),
    renderedBody: text("rendered_body").notNull(),
    mergeData: jsonb("merge_data").$type<Record<string, string>>(),
    documensoDocumentId: varchar("documenso_document_id", { length: 255 }),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    countersignedAt: timestamp("countersigned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contracts_organization_id_idx").on(table.organizationId),
    index("contracts_pipeline_item_id_idx").on(table.pipelineItemId),
    index("contracts_org_status_idx").on(table.organizationId, table.status),
    index("contracts_documenso_id_idx").on(table.documensoDocumentId),
    orgIsolationPolicy,
  ],
).enableRLS();
