import {
  boolean,
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  csrStatusEnum,
  correspondenceDirectionEnum,
  correspondenceChannelEnum,
} from "./enums";
import { users } from "./users";
import { manuscripts } from "./manuscripts";
import { submissions } from "./submissions";

// ---------------------------------------------------------------------------
// journal_directory — Global shared journal registry
// Read-only for authenticated users. Writes via superuser pool only.
// ---------------------------------------------------------------------------

export const journalDirectory = pgTable(
  "journal_directory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 500 }).notNull(),
    normalizedName: varchar("normalized_name", { length: 500 }).notNull(),
    externalUrl: varchar("external_url", { length: 1000 }),
    colophonyDomain: varchar("colophony_domain", { length: 512 }),
    colophonyOrgId: uuid("colophony_org_id"),
    directoryIds: jsonb("directory_ids")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("journal_directory_normalized_name_unique").on(table.normalizedName),
    index("journal_directory_colophony_domain_idx").on(table.colophonyDomain),
    pgPolicy("journal_directory_read", {
      for: "select",
      using: sql`current_user_id() IS NOT NULL`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// external_submissions — User-scoped external submission tracking
// ---------------------------------------------------------------------------

export const externalSubmissions = pgTable(
  "external_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    manuscriptId: uuid("manuscript_id").references(() => manuscripts.id, {
      onDelete: "set null",
    }),
    journalDirectoryId: uuid("journal_directory_id").references(
      () => journalDirectory.id,
      { onDelete: "set null" },
    ),
    journalName: varchar("journal_name", { length: 500 }).notNull(),
    status: csrStatusEnum("status").notNull().default("sent"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    method: varchar("method", { length: 100 }),
    notes: text("notes"),
    importedFrom: varchar("imported_from", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("external_submissions_user_id_idx").on(table.userId),
    index("external_submissions_user_status_idx").on(
      table.userId,
      table.status,
    ),
    index("external_submissions_manuscript_id_idx").on(table.manuscriptId),
    index("external_submissions_journal_directory_id_idx").on(
      table.journalDirectoryId,
    ),
    pgPolicy("external_submissions_owner", {
      for: "all",
      using: sql`user_id = current_user_id()`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// correspondence — Editor-writer messages
// NOTE: XOR CHECK constraint on (submission_id, external_submission_id)
// enforced in migration SQL — Drizzle DSL does not support table-level CHECK.
// ---------------------------------------------------------------------------

export const correspondence = pgTable(
  "correspondence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "cascade",
    }),
    externalSubmissionId: uuid("external_submission_id").references(
      () => externalSubmissions.id,
      { onDelete: "cascade" },
    ),
    direction: correspondenceDirectionEnum("direction").notNull(),
    channel: correspondenceChannelEnum("channel").notNull().default("email"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    subject: varchar("subject", { length: 500 }),
    body: text("body").notNull(),
    senderName: varchar("sender_name", { length: 255 }),
    senderEmail: varchar("sender_email", { length: 255 }),
    isPersonalized: boolean("is_personalized").notNull().default(false),
    source: varchar("source", { length: 50 }).notNull().default("manual"),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("correspondence_user_id_idx").on(table.userId),
    index("correspondence_submission_id_idx").on(table.submissionId),
    index("correspondence_external_submission_id_idx").on(
      table.externalSubmissionId,
    ),
    pgPolicy("correspondence_owner", {
      for: "all",
      using: sql`user_id = current_user_id()`,
    }),
    pgPolicy("correspondence_org_read", {
      for: "select",
      using: sql`submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      )`,
    }),
    pgPolicy("correspondence_org_insert", {
      for: "insert",
      withCheck: sql`submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// writer_profiles — External platform links
// ---------------------------------------------------------------------------

export const writerProfiles = pgTable(
  "writer_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 100 }).notNull(),
    externalId: varchar("external_id", { length: 500 }),
    profileUrl: varchar("profile_url", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    unique("writer_profiles_user_platform_unique").on(
      table.userId,
      table.platform,
    ),
    index("writer_profiles_user_id_idx").on(table.userId),
    index("writer_profiles_platform_external_id_idx").on(
      table.platform,
      table.externalId,
    ),
    pgPolicy("writer_profiles_owner", {
      for: "all",
      using: sql`user_id = current_user_id()`,
    }),
  ],
).enableRLS();
