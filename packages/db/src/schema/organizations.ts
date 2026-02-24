import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    settings: jsonb("settings").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
    federationOptedOut: boolean("federation_opted_out")
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("organizations_lower_slug_idx").on(sql`lower(${table.slug})`),
    index("organizations_settings_gin_idx").using(
      "gin",
      sql`${table.settings} jsonb_path_ops`,
    ),
  ],
);
