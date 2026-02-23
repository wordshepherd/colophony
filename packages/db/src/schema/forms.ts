import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { formStatusEnum, formFieldTypeEnum } from "./enums";

/** Inline type for page branching rules JSONB column — mirrors PageBranchingRule from @colophony/types. */
export interface PageBranchingRuleJson {
  targetPageId: string;
  condition: {
    operator: "AND" | "OR";
    rules: Array<{
      field: string;
      comparator: RuleComparatorJson;
      value?: string | number | boolean | string[];
    }>;
  };
}

/** Inline type for conditional rules JSONB column — mirrors ConditionalRule from @colophony/types. */
export type RuleComparatorJson =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";
export interface ConditionalRuleJson {
  effect: "SHOW" | "HIDE" | "REQUIRE";
  condition: {
    operator: "AND" | "OR";
    rules: Array<{
      field: string;
      comparator: RuleComparatorJson;
      value?: string | number | boolean | string[];
    }>;
  };
}
import { organizations } from "./organizations";
import { users } from "./users";

// --- form_definitions ---

export const formDefinitions = pgTable(
  "form_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    status: formStatusEnum("status").notNull().default("DRAFT"),
    version: integer("version").notNull().default(1),
    duplicatedFromId: uuid("duplicated_from_id"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("form_definitions_organization_id_idx").on(table.organizationId),
    index("form_definitions_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    pgPolicy("form_definitions_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();

// --- form_pages ---

export const formPages = pgTable(
  "form_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formDefinitionId: uuid("form_definition_id")
      .notNull()
      .references(() => formDefinitions.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    branchingRules: jsonb("branching_rules").$type<PageBranchingRuleJson[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("form_pages_form_definition_id_idx").on(table.formDefinitionId),
    index("form_pages_form_sort_idx").on(
      table.formDefinitionId,
      table.sortOrder,
    ),
    pgPolicy("form_pages_org_isolation", {
      for: "all",
      using: sql`form_definition_id IN (
        SELECT id FROM form_definitions
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();

// --- form_fields ---

export const formFields = pgTable(
  "form_fields",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    formDefinitionId: uuid("form_definition_id")
      .notNull()
      .references(() => formDefinitions.id, { onDelete: "cascade" }),
    fieldKey: varchar("field_key", { length: 100 }).notNull(),
    fieldType: formFieldTypeEnum("field_type").notNull(),
    label: varchar("label", { length: 500 }).notNull(),
    description: text("description"),
    placeholder: varchar("placeholder", { length: 500 }),
    required: boolean("required").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config").$type<Record<string, unknown>>().default({}),
    conditionalRules: jsonb("conditional_rules").$type<ConditionalRuleJson[]>(),
    branchId: varchar("branch_id", { length: 36 }),
    pageId: uuid("page_id").references(() => formPages.id, {
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
    index("form_fields_form_definition_id_idx").on(table.formDefinitionId),
    index("form_fields_branch_id_idx").on(table.branchId),
    index("form_fields_form_sort_idx").on(
      table.formDefinitionId,
      table.sortOrder,
    ),
    uniqueIndex("form_fields_form_field_key_idx").on(
      table.formDefinitionId,
      table.fieldKey,
    ),
    pgPolicy("form_fields_org_isolation", {
      for: "all",
      using: sql`form_definition_id IN (
        SELECT id FROM form_definitions
        WHERE organization_id = current_org_id()
      )`,
    }),
  ],
).enableRLS();
