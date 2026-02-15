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
    emailVerified: boolean("email_verified").default(false).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
  },
  (table) => [
    index("users_lower_email_idx").on(sql`lower(${table.email})`),
    uniqueIndex("users_zitadel_user_id_idx")
      .on(table.zitadelUserId)
      .where(sql`${table.zitadelUserId} IS NOT NULL`),
  ],
);
