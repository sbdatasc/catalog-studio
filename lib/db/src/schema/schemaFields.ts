import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schemaEntityTypesTable } from "./schemaEntityTypes";
import type { FieldConfig, FieldType } from "../types";

export const schemaFieldsTable = pgTable(
  "schema_fields",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entityTypeId: uuid("entity_type_id")
      .notNull()
      .references(() => schemaEntityTypesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    fieldType: varchar("field_type", { length: 20 })
      .notNull()
      .$type<FieldType>(),
    required: boolean("required").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    config: jsonb("config").$type<FieldConfig>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("schema_fields_entity_type_name_unique").on(t.entityTypeId, t.name)],
);

export type FieldRow = typeof schemaFieldsTable.$inferSelect;
export type InsertFieldRow = typeof schemaFieldsTable.$inferInsert;
