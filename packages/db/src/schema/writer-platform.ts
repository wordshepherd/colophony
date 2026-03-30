import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { portfolioEntryTypeEnum, simsubGroupStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { manuscripts } from "./manuscripts";
import { submissions } from "./submissions";
import { externalSubmissions } from "./writer-workspace";
import { contributorPublications } from "./business-ops";

// ---------------------------------------------------------------------------
// simsub_groups — User-scoped simultaneous submission groupings
// ---------------------------------------------------------------------------

const userOwnerPolicy = pgPolicy("user_owner", {
  for: "all",
  using: sql`user_id = current_user_id()`,
});

export const simsubGroups = pgTable(
  "simsub_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    manuscriptId: uuid("manuscript_id").references(() => manuscripts.id, {
      onDelete: "set null",
    }),
    status: simsubGroupStatusEnum("status").notNull().default("ACTIVE"),
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
    index("simsub_groups_user_id_idx").on(table.userId),
    index("simsub_groups_user_status_idx").on(table.userId, table.status),
    index("simsub_groups_manuscript_id_idx").on(table.manuscriptId),
    userOwnerPolicy,
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// simsub_group_submissions — Junction: groups ↔ submissions (native or external)
// CHECK constraint (migration-only): exactly one of submission_id or external_submission_id
// Partial unique indexes (migration-only): prevent duplicates per source type
// ---------------------------------------------------------------------------

export const simsubGroupSubmissions = pgTable(
  "simsub_group_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    simsubGroupId: uuid("simsub_group_id")
      .notNull()
      .references(() => simsubGroups.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    externalSubmissionId: uuid("external_submission_id").references(
      () => externalSubmissions.id,
      { onDelete: "cascade" },
    ),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("simsub_group_submissions_group_id_idx").on(table.simsubGroupId),
    index("simsub_group_submissions_submission_id_idx").on(table.submissionId),
    index("simsub_group_submissions_external_id_idx").on(
      table.externalSubmissionId,
    ),
    pgPolicy("simsub_group_submissions_user_owner", {
      for: "all",
      using: sql`user_id = current_user_id()`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// portfolio_entries — User-scoped publication portfolio
// Three types: colophony_verified, federation_verified (future), external
// ---------------------------------------------------------------------------

export const portfolioEntries = pgTable(
  "portfolio_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: portfolioEntryTypeEnum("type").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    publicationName: varchar("publication_name", { length: 500 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    url: varchar("url", { length: 2048 }),
    contributorPublicationId: uuid("contributor_publication_id").references(
      () => contributorPublications.id,
      { onDelete: "set null" },
    ),
    // Forward-declared for federation sync — no code writes to these yet
    federationSourceInstance: varchar("federation_source_instance", {
      length: 512,
    }),
    federationEntryId: uuid("federation_entry_id"),
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
    index("portfolio_entries_user_id_idx").on(table.userId),
    index("portfolio_entries_user_type_idx").on(table.userId, table.type),
    index("portfolio_entries_contributor_publication_id_idx").on(
      table.contributorPublicationId,
    ),
    pgPolicy("portfolio_entries_user_owner", {
      for: "all",
      using: sql`user_id = current_user_id()`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// reader_feedback — Org-scoped feedback from readers on submissions
// Opt-in per org (via organizations.settings JSONB)
// Anonymized when forwarded to writers
// ---------------------------------------------------------------------------

export const readerFeedback = pgTable(
  "reader_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    reviewerUserId: uuid("reviewer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    tags: jsonb("tags")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    comment: varchar("comment", { length: 280 }),
    isForwardable: boolean("is_forwardable").notNull().default(false),
    forwardedAt: timestamp("forwarded_at", { withTimezone: true }),
    forwardedBy: uuid("forwarded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("reader_feedback_organization_id_idx").on(table.organizationId),
    index("reader_feedback_submission_id_idx").on(table.submissionId),
    index("reader_feedback_reviewer_user_id_idx").on(table.reviewerUserId),
    index("reader_feedback_org_submission_idx").on(
      table.organizationId,
      table.submissionId,
    ),
    index("reader_feedback_tags_gin_idx").using(
      "gin",
      sql`${table.tags} jsonb_path_ops`,
    ),
    pgPolicy("reader_feedback_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
    }),
    pgPolicy("reader_feedback_submitter_forwarded_read", {
      for: "select",
      using: sql`forwarded_at IS NOT NULL AND submission_id IN (
        SELECT id FROM submissions WHERE submitter_id = current_user_id()
      )`,
    }),
  ],
).enableRLS();
