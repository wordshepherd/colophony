import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

/**
 * Per-user Ed25519 keypairs for did:web DID document resolution.
 *
 * One active keypair per user (enforced by unique index on userId).
 * RLS: user-scoped — app_user can only read/insert own keys.
 * DID document routes use superuser `db` pool to read public keys.
 */
export const userKeys = pgTable(
  "user_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    publicKey: text("public_key").notNull(),
    privateKey: text("private_key").notNull(),
    keyId: varchar("key_id", { length: 512 }).notNull(),
    algorithm: varchar("algorithm", { length: 50 })
      .notNull()
      .default("Ed25519"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_keys_active_user_idx").on(table.userId),
    pgPolicy("user_keys_owner_select", {
      for: "select",
      using: sql`user_id = current_setting('app.user_id', true)::uuid`,
    }),
    pgPolicy("user_keys_owner_insert", {
      for: "insert",
      withCheck: sql`user_id = current_setting('app.user_id', true)::uuid`,
    }),
  ],
);
