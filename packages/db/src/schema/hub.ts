import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { hubInstanceStatusEnum } from "./enums";

/**
 * Hub-registered instances — global table for managed hosting hub.
 *
 * No RLS — hub-only admin table. `app_user` is REVOKE'd in the migration.
 * Same pattern as `federation_config`.
 */
export const hubRegisteredInstances = pgTable(
  "hub_registered_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    domain: varchar("domain", { length: 512 }).notNull().unique(),
    instanceUrl: varchar("instance_url", { length: 1024 }).notNull(),
    publicKey: text("public_key").notNull(),
    keyId: varchar("key_id", { length: 512 }).notNull(),
    attestationToken: text("attestation_token"),
    attestationExpiresAt: timestamp("attestation_expires_at", {
      withTimezone: true,
    }),
    status: hubInstanceStatusEnum("status").notNull().default("active"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("hub_registered_instances_status_idx").on(table.status)],
);

/**
 * Hub fingerprint index — centralized sim-sub fingerprint store.
 *
 * No RLS — hub-only table. `app_user` is REVOKE'd in the migration.
 */
export const hubFingerprintIndex = pgTable(
  "hub_fingerprint_index",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
    sourceDomain: varchar("source_domain", { length: 512 }).notNull(),
    submitterDid: varchar("submitter_did", { length: 512 }).notNull(),
    publicationName: varchar("publication_name", { length: 255 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("hub_fingerprint_index_fingerprint_idx").on(table.fingerprint),
    unique("hub_fingerprint_index_domain_submitter_fp_unique").on(
      table.sourceDomain,
      table.submitterDid,
      table.fingerprint,
    ),
  ],
);
