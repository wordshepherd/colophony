import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- documenso_webhook_events (no RLS — system table for webhook idempotency) ---

export const documensoWebhookEvents = pgTable(
  "documenso_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documensoId: varchar("documenso_id", { length: 255 }).notNull().unique(),
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
    index("documenso_webhook_events_polling_idx").on(
      table.processedAt,
      table.receivedAt,
    ),
  ],
);
