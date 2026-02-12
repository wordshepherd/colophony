import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  integer,
  boolean,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";

// --- retention_policies (RLS — org-scoped, nullable org for global defaults) ---

export const retentionPolicies = pgTable(
  "retention_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    resource: varchar("resource", { length: 255 }).notNull(),
    retentionDays: integer("retention_days").notNull(),
    condition: text("condition"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("retention_policies_org_resource_idx").on(
      table.organizationId,
      table.resource,
    ),
    index("retention_policies_organization_id_idx").on(table.organizationId),
    pgPolicy("retention_policies_org_isolation", {
      for: "all",
      using: sql`organization_id IS NULL OR organization_id = current_org_id()`,
    }),
  ],
).enableRLS();

// --- user_consents (RLS — org-scoped, nullable org for global consents) ---

export const userConsents = pgTable(
  "user_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    consentType: varchar("consent_type", { length: 100 }).notNull(),
    granted: boolean("granted").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: varchar("ip_address", { length: 45 }),
  },
  (table) => [
    index("user_consents_user_id_idx").on(table.userId),
    index("user_consents_organization_id_idx").on(table.organizationId),
    index("user_consents_user_consent_type_idx").on(
      table.userId,
      table.consentType,
    ),
    pgPolicy("user_consents_org_isolation", {
      for: "all",
      using: sql`organization_id IS NULL OR organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
