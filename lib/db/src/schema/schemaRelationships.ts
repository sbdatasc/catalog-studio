import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schemaTemplatesTable } from "./schemaTemplates";

export const schemaRelationshipsTable = pgTable("schema_relationships", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  fromTemplateId: uuid("from_template_id")
    .notNull()
    .references(() => schemaTemplatesTable.id, { onDelete: "cascade" }),
  toTemplateId: uuid("to_template_id")
    .notNull()
    .references(() => schemaTemplatesTable.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }).notNull(),
  cardinality: varchar("cardinality", { length: 10 })
    .notNull()
    .$type<"1:1" | "1:N" | "M:N">(),
  direction: varchar("direction", { length: 10 })
    .notNull()
    .default("both")
    .$type<"from" | "to" | "both">(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type RelationshipRow = typeof schemaRelationshipsTable.$inferSelect;
export type InsertRelationshipRow = typeof schemaRelationshipsTable.$inferInsert;
