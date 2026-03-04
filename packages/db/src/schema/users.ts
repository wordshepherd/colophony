import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull().unique(),
    zitadelUserId: varchar("zitadel_user_id", { length: 255 }),
    displayName: varchar("display_name", { length: 255 }),
    emailVerified: boolean("email_verified").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
    isGuest: boolean("is_guest").default(false).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    migratedToDomain: varchar("migrated_to_domain", { length: 512 }),
    migratedToDid: varchar("migrated_to_did", { length: 512 }),
    migratedAt: timestamp("migrated_at", { withTimezone: true }),
  },
  (table) => [
    index("users_lower_email_idx").on(sql`lower(${table.email})`),
    uniqueIndex("users_zitadel_user_id_idx")
      .on(table.zitadelUserId)
      .where(sql`${table.zitadelUserId} IS NOT NULL`),
    index("users_migrated_to_domain_idx")
      .on(table.migratedToDomain)
      .where(sql`${table.migratedToDomain} IS NOT NULL`),
  ],
);
