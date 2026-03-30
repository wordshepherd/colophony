import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { contestJudgeRoleEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { submissionPeriods, submissions } from "./submissions";
import { paymentTransactions } from "./business-ops";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- contest_groups ---

export const contestGroups = pgTable(
  "contest_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    totalRoundsPlanned: integer("total_rounds_planned"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("contest_groups_organization_id_idx").on(table.organizationId),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- contest_judges ---

export const contestJudges = pgTable(
  "contest_judges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionPeriodId: uuid("submission_period_id")
      .notNull()
      .references(() => submissionPeriods.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: contestJudgeRoleEnum("role").notNull().default("judge"),
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
  },
  (table) => [
    index("contest_judges_organization_id_idx").on(table.organizationId),
    index("contest_judges_submission_period_id_idx").on(
      table.submissionPeriodId,
    ),
    index("contest_judges_user_id_idx").on(table.userId),
    uniqueIndex("contest_judges_period_user_idx").on(
      table.submissionPeriodId,
      table.userId,
    ),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- contest_results ---

export const contestResults = pgTable(
  "contest_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionPeriodId: uuid("submission_period_id")
      .notNull()
      .references(() => submissionPeriods.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    placement: integer("placement"),
    category: varchar("category", { length: 255 }),
    prizeAmount: integer("prize_amount"),
    prizeCurrency: varchar("prize_currency", { length: 3 })
      .notNull()
      .default("usd"),
    disbursementId: uuid("disbursement_id").references(
      () => paymentTransactions.id,
      { onDelete: "set null" },
    ),
    announcedAt: timestamp("announced_at", { withTimezone: true }),
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
    index("contest_results_organization_id_idx").on(table.organizationId),
    index("contest_results_submission_period_id_idx").on(
      table.submissionPeriodId,
    ),
    index("contest_results_submission_id_idx").on(table.submissionId),
    index("contest_results_disbursement_id_idx").on(table.disbursementId),
    uniqueIndex("contest_results_period_submission_idx").on(
      table.submissionPeriodId,
      table.submissionId,
    ),
    orgIsolationPolicy,
  ],
).enableRLS();
