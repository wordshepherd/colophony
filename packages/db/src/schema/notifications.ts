import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { emailSendStatusEnum, notificationChannelEnum } from "./enums";
import { users } from "./users";

// --- notification_preferences (org-scoped, RLS) ---

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    channel: notificationChannelEnum("channel").notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_preferences_org_user_channel_event_idx").on(
      table.organizationId,
      table.userId,
      table.channel,
      table.eventType,
    ),
    pgPolicy("notification_preferences_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();

// --- email_sends (org-scoped, RLS) ---

export const emailSends = pgTable(
  "email_sends",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    recipientUserId: uuid("recipient_user_id").references(() => users.id),
    recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
    templateName: varchar("template_name", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    subject: varchar("subject", { length: 512 }).notNull(),
    status: emailSendStatusEnum("status").default("QUEUED").notNull(),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    errorMessage: varchar("error_message", { length: 2048 }),
    attempts: integer("attempts").default(0).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("email_sends_org_idx").on(table.organizationId),
    index("email_sends_recipient_idx").on(table.recipientUserId),
    index("email_sends_status_created_idx").on(table.status, table.createdAt),
    index("email_sends_event_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    pgPolicy("email_sends_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();
