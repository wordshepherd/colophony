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
import { dsarTypeEnum, dsarStatusEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

// --- audit_events (RLS — org-scoped, SET NULL on FK for GDPR deletion) ---

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 255 }).notNull(),
    resource: varchar("resource", { length: 255 }).notNull(),
    resourceId: uuid("resource_id"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    requestId: varchar("request_id", { length: 255 }),
    method: varchar("method", { length: 10 }),
    route: varchar("route", { length: 512 }),
    // The acting credential, as opposed to actorId (the effective user).
    // An API key's writes carry principalId = the key and actorId = its creator;
    // a direct human carries principalId NULL.
    //
    // Deliberately NO .references(): the column is polymorphic — api_keys.id
    // today, service_principals.id later — so no single FK is expressible. A
    // dangling id after key deletion is correct for an audit log; the record of
    // what happened must outlive the credential. Do not "fix" this with an FK.
    principalId: uuid("principal_id"),
    principalType: varchar("principal_type", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_events_organization_id_idx").on(table.organizationId),
    index("audit_events_actor_id_idx").on(table.actorId),
    index("audit_events_actor_created_idx").on(table.actorId, table.createdAt),
    index("audit_events_principal_created_idx").on(
      table.principalId,
      table.createdAt,
    ),
    index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    pgPolicy("audit_events_org_isolation_select", {
      for: "select",
      using: sql`organization_id = current_org_id()`,
    }),
    pgPolicy("audit_events_org_isolation_insert", {
      for: "insert",
      withCheck: sql`organization_id IS NULL OR organization_id = current_org_id()`,
    }),
  ],
).enableRLS();

// --- dsar_requests (no RLS — user-scoped, not org-scoped) ---

export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: dsarTypeEnum("type").notNull(),
    status: dsarStatusEnum("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => [
    index("dsar_requests_user_id_idx").on(table.userId),
    index("dsar_requests_status_due_idx").on(table.status, table.dueAt),
  ],
);
