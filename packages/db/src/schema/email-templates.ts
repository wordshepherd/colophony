import {
  pgTable,
  pgPolicy,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateName: varchar("template_name", { length: 64 }).notNull(),
    subjectTemplate: varchar("subject_template", { length: 512 }).notNull(),
    bodyHtml: text("body_html").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("email_templates_org_name_idx").on(
      table.organizationId,
      table.templateName,
    ),
    index("email_templates_organization_id_idx").on(table.organizationId),
    pgPolicy("email_templates_select", {
      for: "select",
      using: sql`organization_id = current_org_id()`,
    }),
    pgPolicy("email_templates_modify", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
