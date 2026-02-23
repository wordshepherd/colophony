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
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { issueStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { publications } from "./publications";
import { pipelineItems } from "./pipeline";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- issues ---

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 500 }).notNull(),
    volume: integer("volume"),
    issueNumber: integer("issue_number"),
    description: text("description"),
    coverImageUrl: varchar("cover_image_url", { length: 1000 }),
    status: issueStatusEnum("status").notNull().default("PLANNING"),
    publicationDate: timestamp("publication_date", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("issues_organization_id_idx").on(table.organizationId),
    index("issues_publication_id_idx").on(table.publicationId),
    index("issues_pub_date_idx").on(table.publicationId, table.publicationDate),
    index("issues_org_status_idx").on(table.organizationId, table.status),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- issue_sections ---

const issueSectionRlsPolicy = pgPolicy("issue_section_org_isolation", {
  for: "all",
  using: sql`EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_id AND issues.organization_id = current_org_id())`,
});

export const issueSections = pgTable(
  "issue_sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("issue_sections_issue_id_idx").on(table.issueId),
    issueSectionRlsPolicy,
  ],
).enableRLS();

// --- issue_items ---

const issueItemRlsPolicy = pgPolicy("issue_item_org_isolation", {
  for: "all",
  using: sql`EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_id AND issues.organization_id = current_org_id())`,
});

export const issueItems = pgTable(
  "issue_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    pipelineItemId: uuid("pipeline_item_id")
      .notNull()
      .references(() => pipelineItems.id, { onDelete: "cascade" }),
    issueSectionId: uuid("issue_section_id").references(
      () => issueSections.id,
      { onDelete: "set null" },
    ),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("issue_items_issue_pipeline_unique").on(
      table.issueId,
      table.pipelineItemId,
    ),
    index("issue_items_issue_id_idx").on(table.issueId),
    index("issue_items_pipeline_item_id_idx").on(table.pipelineItemId),
    issueItemRlsPolicy,
  ],
).enableRLS();
