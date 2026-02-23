import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { cmsAdapterTypeEnum } from "./enums";
import { organizations } from "./organizations";
import { publications } from "./publications";

const orgIsolationPolicy = pgPolicy("org_isolation", {
  for: "all",
  using: sql`organization_id = current_org_id()`,
});

// --- cms_connections ---

export const cmsConnections = pgTable(
  "cms_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    publicationId: uuid("publication_id").references(() => publications.id, {
      onDelete: "cascade",
    }),
    adapterType: cmsAdapterTypeEnum("adapter_type").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("cms_connections_organization_id_idx").on(table.organizationId),
    index("cms_connections_publication_id_idx").on(table.publicationId),
    orgIsolationPolicy,
  ],
).enableRLS();
