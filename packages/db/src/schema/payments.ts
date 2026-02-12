import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  integer,
  jsonb,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { paymentStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { submissions } from "./submissions";

// --- payments ---

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    submissionId: uuid("submission_id").references(() => submissions.id, {
      onDelete: "set null",
    }),
    stripePaymentId: varchar("stripe_payment_id", { length: 255 }).unique(),
    stripeSessionId: varchar("stripe_session_id", { length: 255 }).unique(),
    amount: integer("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("usd"),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("payments_organization_id_idx").on(table.organizationId),
    index("payments_submission_id_idx").on(table.submissionId),
    index("payments_metadata_gin_idx").using(
      "gin",
      sql`${table.metadata} jsonb_path_ops`,
    ),
    pgPolicy("payments_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();

// --- stripe_webhook_events (no RLS — system table) ---

export const stripeWebhookEvents = pgTable(
  "stripe_webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stripeId: varchar("stripe_id", { length: 255 }).notNull().unique(),
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
    index("stripe_webhook_events_polling_idx").on(
      table.processedAt,
      table.receivedAt,
    ),
  ],
);
