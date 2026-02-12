import {
  pgTable,
  pgPolicy,
  uuid,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { roleEnum } from "./enums";
import { organizations } from "./organizations";
import { users } from "./users";

export const organizationMembers = pgTable(
  "organization_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("READER"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("organization_members_org_user_idx").on(
      table.organizationId,
      table.userId,
    ),
    index("organization_members_organization_id_idx").on(table.organizationId),
    index("organization_members_user_id_idx").on(table.userId),
    pgPolicy("organization_members_select", {
      for: "select",
      using: sql`organization_id = current_org_id()`,
    }),
    pgPolicy("organization_members_modify", {
      for: "all",
      using: sql`organization_id = current_org_id()`,
      withCheck: sql`organization_id = current_org_id()`,
    }),
  ],
).enableRLS();
