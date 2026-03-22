import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schemaSectionsTable } from "./schemaSections";
import type { AttributeConfig, AttributeType } from "../types";

export const schemaAttributesTable = pgTable(
  "schema_attributes",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => schemaSectionsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    description: text("description"),
    attributeType: varchar("attribute_type", { length: 20 })
      .notNull()
      .$type<AttributeType>(),
    required: boolean("required").notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
    config: jsonb("config").$type<AttributeConfig>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("schema_attributes_section_name_unique").on(t.sectionId, t.name)],
);

export type AttributeRow = typeof schemaAttributesTable.$inferSelect;
export type InsertAttributeRow = typeof schemaAttributesTable.$inferInsert;
