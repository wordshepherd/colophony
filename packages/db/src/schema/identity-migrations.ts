import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { identityMigrationStatusEnum } from "./enums";
import { users } from "./users";
import { organizations } from "./organizations";

export const identityMigrations = pgTable(
  "identity_migrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    direction: varchar("direction", { length: 10 }).notNull(),
    peerDomain: varchar("peer_domain", { length: 512 }).notNull(),
    peerInstanceUrl: varchar("peer_instance_url", { length: 1024 }),
    userDid: varchar("user_did", { length: 512 }),
    peerUserDid: varchar("peer_user_did", { length: 512 }),
    status: identityMigrationStatusEnum("status").notNull().default("PENDING"),
    migrationToken: text("migration_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    callbackUrl: varchar("callback_url", { length: 1024 }),
    bundleMetadata: jsonb("bundle_metadata"),
    failureReason: text("failure_reason"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("identity_migrations_user_id_idx").on(table.userId),
    index("identity_migrations_peer_domain_idx").on(table.peerDomain),
    index("identity_migrations_status_idx").on(table.status),
    uniqueIndex("identity_migrations_active_unique")
      .on(table.userId, table.direction, table.peerDomain)
      .where(
        sql`status NOT IN ('COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED')`,
      ),
    pgPolicy("identity_migrations_user_isolation", {
      for: "all",
      using: sql`user_id = current_setting('app.user_id', true)::uuid`,
    }),
  ],
).enableRLS();
