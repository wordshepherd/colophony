import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";

// --- notifications_inbox (org-scoped, RLS) ---

export const notificationsInbox = pgTable(
  "notifications_inbox",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    title: varchar("title", { length: 256 }).notNull(),
    body: text("body"),
    link: varchar("link", { length: 2048 }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("notifications_inbox_user_unread_idx").on(
      table.organizationId,
      table.userId,
      table.readAt,
      table.createdAt,
    ),
    index("notifications_inbox_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    pgPolicy("notifications_inbox_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();
