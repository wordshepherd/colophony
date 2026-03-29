import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  contributorPublicationRoleEnum,
  rightsTypeEnum,
  rightsAgreementStatusEnum,
  paymentTransactionTypeEnum,
  paymentTransactionDirectionEnum,
  paymentStatusEnum,
} from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { pipelineItems } from "./pipeline";
import { submissions } from "./submissions";
import { payments } from "./payments";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- contributors ---

export const contributors = pgTable(
  "contributors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    displayName: varchar("display_name", { length: 255 }).notNull(),
    bio: text("bio"),
    pronouns: varchar("pronouns", { length: 100 }),
    email: varchar("email", { length: 320 }),
    website: varchar("website", { length: 2048 }),
    // Sensitive field — full-disk encryption + RLS provides baseline protection.
    // Application-level column encryption deferred as a cross-cutting concern.
    mailingAddress: text("mailing_address"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contributors_organization_id_idx").on(table.organizationId),
    index("contributors_user_id_idx").on(table.userId),
    index("contributors_org_name_idx").on(
      table.organizationId,
      table.displayName,
    ),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- contributor_publications ---

export const contributorPublications = pgTable(
  "contributor_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "cascade" }),
    pipelineItemId: uuid("pipeline_item_id")
      .notNull()
      .references(() => pipelineItems.id, { onDelete: "cascade" }),
    role: contributorPublicationRoleEnum("role").notNull().default("author"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("contributor_publications_contributor_id_idx").on(
      table.contributorId,
    ),
    index("contributor_publications_pipeline_item_id_idx").on(
      table.pipelineItemId,
    ),
    uniqueIndex("contributor_publications_contributor_item_role_idx").on(
      table.contributorId,
      table.pipelineItemId,
      table.role,
    ),
    pgPolicy("contributor_publications_org_isolation", {
      for: "all",
      using: sql`contributor_id IN (
        SELECT id FROM contributors
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();

// --- rights_agreements ---

export const rightsAgreements = pgTable(
  "rights_agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id")
      .notNull()
      .references(() => contributors.id, { onDelete: "restrict" }),
    pipelineItemId: uuid("pipeline_item_id").references(
      () => pipelineItems.id,
      { onDelete: "set null" },
    ),
    rightsType: rightsTypeEnum("rights_type").notNull(),
    customDescription: text("custom_description"),
    status: rightsAgreementStatusEnum("status").notNull().default("DRAFT"),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revertedAt: timestamp("reverted_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("rights_agreements_organization_id_idx").on(table.organizationId),
    index("rights_agreements_contributor_id_idx").on(table.contributorId),
    index("rights_agreements_pipeline_item_id_idx").on(table.pipelineItemId),
    index("rights_agreements_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("rights_agreements_org_expires_idx").on(
      table.organizationId,
      table.expiresAt,
    ),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- payment_transactions ---

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contributorId: uuid("contributor_id").references(() => contributors.id, {
      onDelete: "set null",
    }),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    paymentId: uuid("payment_id").references(() => payments.id, {
      onDelete: "set null",
    }),
    type: paymentTransactionTypeEnum("type").notNull(),
    direction: paymentTransactionDirectionEnum("direction").notNull(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    description: text("description"),
    metadata: jsonb("metadata").default({}),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("payment_transactions_organization_id_idx").on(table.organizationId),
    index("payment_transactions_contributor_id_idx").on(table.contributorId),
    index("payment_transactions_submission_id_idx").on(table.submissionId),
    index("payment_transactions_payment_id_idx").on(table.paymentId),
    index("payment_transactions_org_type_idx").on(
      table.organizationId,
      table.type,
    ),
    index("payment_transactions_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    index("payment_transactions_metadata_gin_idx").using(
      "gin",
      sql`${table.metadata} jsonb_path_ops`,
    ),
    orgIsolationPolicy,
  ],
).enableRLS();
