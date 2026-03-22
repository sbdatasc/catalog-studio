import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { catalogsTable } from "./catalogs";

export const schemaTemplatesTable = pgTable(
  "schema_templates",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => catalogsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    isSystemSeed: boolean("is_system_seed").notNull().default(false),
    isReferenceData: boolean("is_reference_data").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("schema_templates_catalog_name_unique").on(t.catalogId, t.name),
    uniqueIndex("schema_templates_catalog_slug_unique").on(t.catalogId, t.slug),
  ],
);

export type TemplateRow = typeof schemaTemplatesTable.$inferSelect;
export type InsertTemplateRow = typeof schemaTemplatesTable.$inferInsert;
