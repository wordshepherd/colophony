import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { federationModeEnum } from "./enums";

/**
 * Instance-level singleton table for federation configuration.
 *
 * No RLS — admin-only via superuser pool. `app_user` is REVOKE'd in the
 * migration. The `singleton` column with a UNIQUE constraint enforces
 * exactly one row.
 */
export const federationConfig = pgTable("federation_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  singleton: boolean("singleton").notNull().default(true).unique(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  keyId: varchar("key_id", { length: 512 }).notNull(),
  mode: federationModeEnum("mode").notNull().default("allowlist"),
  contactEmail: varchar("contact_email", { length: 255 }),
  capabilities: jsonb("capabilities")
    .$type<string[]>()
    .notNull()
    .default(sql`'["identity"]'::jsonb`),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
