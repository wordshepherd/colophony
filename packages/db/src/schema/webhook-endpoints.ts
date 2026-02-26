import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  jsonb,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { webhookEndpointStatusEnum, webhookDeliveryStatusEnum } from "./enums";

// --- webhook_endpoints (org-scoped, RLS) ---

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    url: varchar("url", { length: 2048 }).notNull(),
    secret: varchar("secret", { length: 512 }).notNull(),
    description: varchar("description", { length: 512 }),
    eventTypes: jsonb("event_types").notNull(),
    status: webhookEndpointStatusEnum("status").default("ACTIVE").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("webhook_endpoints_org_idx").on(table.organizationId),
    index("webhook_endpoints_status_idx").on(table.status),
    pgPolicy("webhook_endpoints_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();

// --- webhook_deliveries (org-scoped, RLS) ---

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    webhookEndpointId: uuid("webhook_endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 128 }).notNull(),
    eventId: varchar("event_id", { length: 255 }).notNull(),
    payload: jsonb("payload").notNull(),
    status: webhookDeliveryStatusEnum("status").default("QUEUED").notNull(),
    httpStatusCode: integer("http_status_code"),
    responseBody: varchar("response_body", { length: 4096 }),
    errorMessage: varchar("error_message", { length: 2048 }),
    attempts: integer("attempts").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("webhook_deliveries_endpoint_created_idx").on(
      table.webhookEndpointId,
      table.createdAt,
    ),
    index("webhook_deliveries_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("webhook_deliveries_event_type_created_idx").on(
      table.eventType,
      table.createdAt,
    ),
    pgPolicy("webhook_deliveries_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
  ],
).enableRLS();
