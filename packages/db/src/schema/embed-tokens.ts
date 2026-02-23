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
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { submissionPeriods } from "./submissions";
import { users } from "./users";

export interface EmbedThemeConfig {
  primaryColor?: string;
  fontFamily?: string;
  borderRadius?: string;
  darkMode?: boolean;
}

export const embedTokens = pgTable(
  "embed_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    submissionPeriodId: uuid("submission_period_id")
      .notNull()
      .references(() => submissionPeriods.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    tokenPrefix: varchar("token_prefix", { length: 16 }).notNull(),
    allowedOrigins: text("allowed_origins")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    themeConfig: jsonb("theme_config").default({}).$type<EmbedThemeConfig>(),
    active: boolean("active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("embed_tokens_organization_id_idx").on(table.organizationId),
    index("embed_tokens_submission_period_id_idx").on(table.submissionPeriodId),
    index("embed_tokens_token_hash_idx").on(table.tokenHash),
    pgPolicy("embed_tokens_org_isolation", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
