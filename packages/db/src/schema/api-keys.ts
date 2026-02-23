import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 255 }).notNull(),
    keyHash: varchar("key_hash", { length: 128 }).notNull().unique(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    scopes: jsonb("scopes").notNull().$type<string[]>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("api_keys_organization_id_idx").on(table.organizationId),
    index("api_keys_key_hash_idx").on(table.keyHash),
    pgPolicy("api_keys_select", {
      for: "select",
      using: sql`organization_id = current_org_id()`,
    }),
    pgPolicy("api_keys_modify", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
