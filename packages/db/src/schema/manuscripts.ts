import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { scanStatusEnum } from "./enums";
import { users } from "./users";

// ---------------------------------------------------------------------------
// manuscripts — user-scoped (NOT org-scoped)
// ---------------------------------------------------------------------------

export const manuscripts = pgTable(
  "manuscripts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("manuscripts_owner_id_idx").on(table.ownerId),
    pgPolicy("manuscripts_owner", {
      for: "all",
      using: sql`owner_id = current_user_id()`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// manuscript_versions — user-scoped via manuscript ownership chain
// ---------------------------------------------------------------------------

export const manuscriptVersions = pgTable(
  "manuscript_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manuscriptId: uuid("manuscript_id")
      .notNull()
      .references(() => manuscripts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    label: varchar("label", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("manuscript_versions_manuscript_id_idx").on(table.manuscriptId),
    unique("manuscript_versions_manuscript_version_unique").on(
      table.manuscriptId,
      table.versionNumber,
    ),
    pgPolicy("manuscript_versions_owner", {
      for: "all",
      using: sql`manuscript_id IN (SELECT id FROM manuscripts WHERE owner_id = current_user_id())`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// files — replaces submission_files; dual RLS (owner + org read)
// ---------------------------------------------------------------------------

export const files = pgTable(
  "files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    manuscriptVersionId: uuid("manuscript_version_id")
      .notNull()
      .references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    filename: varchar("filename", { length: 500 }).notNull(),
    mimeType: varchar("mime_type", { length: 255 }).notNull(),
    size: bigint("size", { mode: "number" }).notNull(),
    storageKey: varchar("storage_key", { length: 1000 }).notNull(),
    scanStatus: scanStatusEnum("scan_status").notNull().default("PENDING"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("files_manuscript_version_id_idx").on(table.manuscriptVersionId),
    index("files_version_scan_status_idx").on(
      table.manuscriptVersionId,
      table.scanStatus,
      table.uploadedAt,
    ),
    // Owner CRUD: accessible via manuscript ownership chain
    pgPolicy("files_owner", {
      for: "all",
      using: sql`manuscript_version_id IN (
        SELECT mv.id FROM manuscript_versions mv
        JOIN manuscripts m ON mv.manuscript_id = m.id
        WHERE m.owner_id = current_user_id()
      )`,
    }),
    // Org read: editors can read files on non-draft submissions in their org
    pgPolicy("files_org_read", {
      for: "select",
      using: sql`manuscript_version_id IN (
        SELECT s.manuscript_version_id FROM submissions s
        WHERE s.organization_id = current_org_id()
        AND s.manuscript_version_id IS NOT NULL
        AND s.status != 'DRAFT'
      )`,
    }),
  ],
).enableRLS();
