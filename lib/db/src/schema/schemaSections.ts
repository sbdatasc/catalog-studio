import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schemaTemplatesTable } from "./schemaTemplates";

export const schemaSectionsTable = pgTable(
  "schema_sections",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    templateId: uuid("template_id")
      .notNull()
      .references(() => schemaTemplatesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("schema_sections_template_name_unique").on(t.templateId, t.name)],
);

export type SectionRow = typeof schemaSectionsTable.$inferSelect;
export type InsertSectionRow = typeof schemaSectionsTable.$inferInsert;
