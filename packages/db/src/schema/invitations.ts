import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { roleEnum, invitationStatusEnum } from "./enums";

export const organizationInvitations = pgTable(
  "organization_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    roles: roleEnum("roles")
      .array()
      .notNull()
      .default(sql`ARRAY['READER']::"Role"[]`),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    tokenPrefix: varchar("token_prefix", { length: 16 }).notNull(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedBy: uuid("accepted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_invitations_org_email_pending_idx")
      .on(table.organizationId, table.email)
      .where(sql`status = 'PENDING'`),
    index("organization_invitations_organization_id_idx").on(
      table.organizationId,
    ),
    index("organization_invitations_token_hash_idx").on(table.tokenHash),
    index("organization_invitations_email_idx").on(table.email),
    pgPolicy("organization_invitations_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
