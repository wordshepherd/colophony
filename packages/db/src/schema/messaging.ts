import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// --- outbox_events (no RLS — system table for transactional outbox) ---

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    retryCount: integer("retry_count").default(0).notNull(),
  },
  (table) => [
    index("outbox_events_ready_idx").on(table.processedAt, table.createdAt),
  ],
);
