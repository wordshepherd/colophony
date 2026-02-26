import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { pieceTransferStatusEnum, inboundTransferStatusEnum } from "./enums";
import { submissions } from "./submissions";
import { manuscriptVersions } from "./manuscripts";
import { users } from "./users";
import { organizations } from "./organizations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransferFileManifestEntry {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// ---------------------------------------------------------------------------
// piece_transfers — origin-side transfer tracking
// ---------------------------------------------------------------------------

export const pieceTransfers = pgTable(
  "piece_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    submissionId: uuid("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    manuscriptVersionId: uuid("manuscript_version_id")
      .notNull()
      .references(() => manuscriptVersions.id, { onDelete: "cascade" }),
    initiatedByUserId: uuid("initiated_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetDomain: varchar("target_domain", { length: 512 }).notNull(),
    status: pieceTransferStatusEnum("status").notNull().default("PENDING"),
    transferToken: text("transfer_token").notNull(),
    tokenExpiresAt: timestamp("token_expires_at", {
      withTimezone: true,
    }).notNull(),
    fileManifest: jsonb("file_manifest")
      .$type<TransferFileManifestEntry[]>()
      .notNull(),
    contentFingerprint: varchar("content_fingerprint", { length: 64 }),
    submitterDid: varchar("submitter_did", { length: 512 }).notNull(),
    remoteTransferId: varchar("remote_transfer_id", { length: 255 }),
    remoteResponse: jsonb("remote_response"),
    failureReason: text("failure_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("piece_transfers_submission_id_idx").on(table.submissionId),
    index("piece_transfers_initiated_by_user_id_idx").on(
      table.initiatedByUserId,
    ),
    index("piece_transfers_target_domain_idx").on(table.targetDomain),
    index("piece_transfers_status_idx").on(table.status),
    pgPolicy("piece_transfers_org_isolation", {
      for: "all",
      using: sql`submission_id IN (SELECT id FROM submissions WHERE organization_id = current_org_id())`,
    }),
  ],
).enableRLS();

// ---------------------------------------------------------------------------
// inbound_transfers — destination-side transfer tracking
// ---------------------------------------------------------------------------

export const inboundTransfers = pgTable(
  "inbound_transfers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    submissionId: uuid("submission_id").references(() => submissions.id),
    sourceDomain: varchar("source_domain", { length: 512 }).notNull(),
    remoteTransferId: varchar("remote_transfer_id", { length: 255 }).notNull(),
    submitterDid: varchar("submitter_did", { length: 512 }).notNull(),
    contentFingerprint: varchar("content_fingerprint", { length: 64 }),
    fileManifest: jsonb("file_manifest"),
    status: inboundTransferStatusEnum("status").notNull().default("RECEIVED"),
    failureReason: text("failure_reason"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    pgPolicy("inbound_transfers_org_isolation", {
      for: "all",
      using: sql`organization_id = current_setting('app.current_org')::uuid`,
    }),
    uniqueIndex("inbound_transfers_remote_unique").on(
      table.sourceDomain,
      table.remoteTransferId,
    ),
  ],
).enableRLS();
