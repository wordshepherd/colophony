import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
// --- zitadel_webhook_events (no RLS — system table) ---

export const zitadelWebhookEvents = pgTable(
  "zitadel_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: varchar("event_id", { length: 255 }).notNull(),
    type: varchar("type", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("zitadel_webhook_events_event_id_idx").on(table.eventId),
    index("zitadel_webhook_events_ready_idx").on(
      table.processedAt,
      table.receivedAt,
    ),
  ],
);
