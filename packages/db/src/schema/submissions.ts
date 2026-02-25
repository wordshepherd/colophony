import {
  boolean,
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  numeric,
  jsonb,
  index,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { submissionStatusEnum, simSubCheckResultEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { formDefinitions } from "./forms";
import { manuscriptVersions } from "./manuscripts";
import { publications } from "./publications";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- submission_periods ---

export const submissionPeriods = pgTable(
  "submission_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    fee: numeric("fee", { precision: 10, scale: 2 }),
    maxSubmissions: integer("max_submissions"),
    formDefinitionId: uuid("form_definition_id").references(
      () => formDefinitions.id,
      { onDelete: "set null" },
    ),
    publicationId: uuid("publication_id").references(() => publications.id, {
      onDelete: "set null",
    }),
    simSubProhibited: boolean("sim_sub_prohibited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("submission_periods_organization_id_idx").on(table.organizationId),
    index("submission_periods_org_dates_idx").on(
      table.organizationId,
      table.opensAt,
      table.closesAt,
    ),
    index("submission_periods_form_definition_id_idx").on(
      table.formDefinitionId,
    ),
    index("submission_periods_publication_id_idx").on(table.publicationId),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- submissions ---

export const submissions = pgTable(
  "submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submitterId: uuid("submitter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    submissionPeriodId: uuid("submission_period_id").references(
      () => submissionPeriods.id,
      { onDelete: "set null" },
    ),
    formDefinitionId: uuid("form_definition_id").references(
      () => formDefinitions.id,
      { onDelete: "set null" },
    ),
    manuscriptVersionId: uuid("manuscript_version_id").references(
      () => manuscriptVersions.id,
      { onDelete: "set null" },
    ),
    title: varchar("title", { length: 500 }),
    content: text("content"),
    coverLetter: text("cover_letter"),
    formData: jsonb("form_data").$type<Record<string, unknown>>(),
    status: submissionStatusEnum("status").notNull().default("DRAFT"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
    simSubOverride: boolean("sim_sub_override").notNull().default(false),
    simSubCheckResult: simSubCheckResultEnum("sim_sub_check_result"),
    simSubCheckedAt: timestamp("sim_sub_checked_at", { withTimezone: true }),
    transferredFromDomain: varchar("transferred_from_domain", { length: 512 }),
    transferredFromTransferId: varchar("transferred_from_transfer_id", {
      length: 255,
    }),
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("submissions_organization_id_idx").on(table.organizationId),
    index("submissions_submitter_id_idx").on(table.submitterId),
    index("submissions_submitter_status_idx").on(
      table.submitterId,
      table.status,
    ),
    index("submissions_submission_period_id_idx").on(table.submissionPeriodId),
    index("submissions_form_definition_id_idx").on(table.formDefinitionId),
    index("submissions_manuscript_version_id_idx").on(
      table.manuscriptVersionId,
    ),
    index("submissions_org_status_submitted_idx").on(
      table.organizationId,
      table.status,
      table.submittedAt,
    ),
    index("submissions_search_vector_idx").using("gin", table.searchVector),
    orgIsolationPolicy,
    // Submitter-scoped read: submitters can see their own submissions cross-org
    pgPolicy("submissions_submitter_read", {
      for: "select",
      using: sql`submitter_id = current_user_id()`,
    }),
  ],
).enableRLS();

// --- submission_history ---

export const submissionHistory = pgTable(
  "submission_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    fromStatus: submissionStatusEnum("from_status"),
    toStatus: submissionStatusEnum("to_status").notNull(),
    changedBy: uuid("changed_by"),
    comment: text("comment"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("submission_history_submission_id_idx").on(table.submissionId),
    index("submission_history_changed_at_idx").on(
      table.submissionId,
      table.changedAt,
    ),
    pgPolicy("submission_history_org_isolation", {
      for: "all",
      using: sql`submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();

// --- sim_sub_checks ---

export const simSubChecks = pgTable(
  "sim_sub_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    submitterDid: varchar("submitter_did", { length: 512 }).notNull(),
    result: simSubCheckResultEnum("result").notNull(),
    localConflicts: jsonb("local_conflicts")
      .$type<
        Array<{
          publicationName: string;
          submittedAt: string;
          periodName?: string;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    remoteResults: jsonb("remote_results")
      .$type<
        Array<{
          domain: string;
          status: "checked" | "timeout" | "error" | "unreachable";
          found?: boolean;
          conflicts?: Array<{
            publicationName: string;
            submittedAt: string;
            periodName?: string;
          }>;
          durationMs?: number;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    overriddenBy: uuid("overridden_by").references(() => users.id, {
      onDelete: "set null",
    }),
    overriddenAt: timestamp("overridden_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sim_sub_checks_submission_id_idx").on(table.submissionId),
    index("sim_sub_checks_fingerprint_idx").on(table.fingerprint),
    pgPolicy("sim_sub_checks_org_isolation", {
      for: "all",
      using: sql`submission_id IN (
        SELECT id FROM submissions
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();
