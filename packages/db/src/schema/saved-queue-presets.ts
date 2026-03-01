import {
  boolean,
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

export const savedQueuePresets = pgTable(
  "saved_queue_presets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    filters: jsonb("filters").notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("saved_queue_presets_org_user_name_idx").on(
      table.organizationId,
      table.userId,
      table.name,
    ),
    index("saved_queue_presets_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
    uniqueIndex("saved_queue_presets_one_default_per_user_idx")
      .on(table.organizationId, table.userId)
      .where(sql`is_default = true`),
    pgPolicy("org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
