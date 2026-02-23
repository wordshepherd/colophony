import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pipelineStageEnum } from "./enums";
import { organizations } from "./organizations";
import { submissions } from "./submissions";
import { publications } from "./publications";
import { users } from "./users";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- pipeline_items ---

export const pipelineItems = pgTable(
  "pipeline_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "restrict" }),
    publicationId: uuid("publication_id").references(() => publications.id, {
      onDelete: "set null",
    }),
    stage: pipelineStageEnum("stage").notNull().default("COPYEDIT_PENDING"),
    assignedCopyeditorId: uuid("assigned_copyeditor_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    assignedProofreaderId: uuid("assigned_proofreader_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    copyeditDueAt: timestamp("copyedit_due_at", { withTimezone: true }),
    proofreadDueAt: timestamp("proofread_due_at", { withTimezone: true }),
    authorReviewDueAt: timestamp("author_review_due_at", {
      withTimezone: true,
    }),
    inngestRunId: varchar("inngest_run_id", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("pipeline_items_organization_id_idx").on(table.organizationId),
    uniqueIndex("pipeline_items_submission_id_idx").on(table.submissionId),
    index("pipeline_items_publication_id_idx").on(table.publicationId),
    index("pipeline_items_org_stage_idx").on(table.organizationId, table.stage),
    index("pipeline_items_copyeditor_idx").on(table.assignedCopyeditorId),
    index("pipeline_items_proofreader_idx").on(table.assignedProofreaderId),
    orgIsolationPolicy,
  ],
).enableRLS();

// --- pipeline_history ---

export const pipelineHistory = pgTable(
  "pipeline_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineItemId: uuid("pipeline_item_id")
      .notNull()
      .references(() => pipelineItems.id, { onDelete: "cascade" }),
    fromStage: pipelineStageEnum("from_stage"),
    toStage: pipelineStageEnum("to_stage").notNull(),
    changedBy: uuid("changed_by"),
    comment: text("comment"),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pipeline_history_item_id_idx").on(table.pipelineItemId),
    index("pipeline_history_changed_at_idx").on(
      table.pipelineItemId,
      table.changedAt,
    ),
    pgPolicy("pipeline_history_org_isolation", {
      for: "all",
      using: sql`pipeline_item_id IN (
        SELECT id FROM pipeline_items
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();

// --- pipeline_comments ---

export const pipelineComments = pgTable(
  "pipeline_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pipelineItemId: uuid("pipeline_item_id")
      .notNull()
      .references(() => pipelineItems.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    content: text("content").notNull(),
    stage: pipelineStageEnum("stage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("pipeline_comments_item_id_idx").on(table.pipelineItemId),
    pgPolicy("pipeline_comments_org_isolation", {
      for: "all",
      using: sql`pipeline_item_id IN (
        SELECT id FROM pipeline_items
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();
