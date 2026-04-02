import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";

export const demoRequests = pgTable("demo_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  magazineName: varchar("magazine_name", { length: 256 }).notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
