import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { peerTrustStatusEnum } from "./enums";
import { organizations } from "./organizations";

export const trustedPeers = pgTable(
  "trusted_peers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    domain: varchar("domain", { length: 512 }).notNull(),
    instanceUrl: varchar("instance_url", { length: 1024 }).notNull(),
    publicKey: text("public_key").notNull(),
    keyId: varchar("key_id", { length: 512 }).notNull(),
    grantedCapabilities: jsonb("granted_capabilities")
      .$type<Record<string, boolean>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: peerTrustStatusEnum("status").notNull().default("pending_outbound"),
    initiatedBy: varchar("initiated_by", { length: 10 })
      .notNull()
      .$type<"local" | "remote">(),
    protocolVersion: varchar("protocol_version", { length: 20 })
      .notNull()
      .default("1.0"),
    hubAttested: boolean("hub_attested").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("trusted_peers_organization_id_idx").on(table.organizationId),
    index("trusted_peers_domain_idx").on(table.domain),
    index("trusted_peers_org_status_idx").on(
      table.organizationId,
      table.status,
    ),
    unique("trusted_peers_org_domain_unique").on(
      table.organizationId,
      table.domain,
    ),
    pgPolicy("trusted_peers_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
