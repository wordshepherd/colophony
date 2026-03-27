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
import { collectionVisibilityEnum, collectionTypeHintEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";
import { submissions } from "./submissions";

// --- workspace_collections ---

const collectionOrgPolicy = pgPolicy("workspace_collections_org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

export const workspaceCollections = pgTable(
  "workspace_collections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    visibility: collectionVisibilityEnum("visibility")
      .notNull()
      .default("private"),
    typeHint: collectionTypeHintEnum("type_hint").notNull().default("custom"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("workspace_collections_org_id_idx").on(table.organizationId),
    index("workspace_collections_owner_idx").on(
      table.organizationId,
      table.ownerId,
    ),
    collectionOrgPolicy,
  ],
).enableRLS();

// --- workspace_items ---

const itemOrgPolicy = pgPolicy("workspace_items_org_isolation", {
  for: "all",
  using: sql`EXISTS (SELECT 1 FROM workspace_collections wc WHERE wc.id = collection_id AND wc.organization_id = current_org_id())`,
});

export const workspaceItems = pgTable(
  "workspace_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => workspaceCollections.id, { onDelete: "cascade" }),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    notes: text("notes"),
    color: varchar("color", { length: 50 }),
    icon: varchar("icon", { length: 50 }),
    readingAnchor: jsonb("reading_anchor").$type<Record<
      string,
      unknown
    > | null>(),
    addedAt: timestamp("added_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    touchedAt: timestamp("touched_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("workspace_items_collection_id_idx").on(table.collectionId),
    index("workspace_items_submission_id_idx").on(table.submissionId),
    unique("workspace_items_collection_submission_unique").on(
      table.collectionId,
      table.submissionId,
    ),
    itemOrgPolicy,
  ],
).enableRLS();
