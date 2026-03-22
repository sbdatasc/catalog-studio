import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { catalogEntriesTable } from "./catalogEntries";

export const catalogFieldValuesTable = pgTable(
  "catalog_field_values",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => catalogEntriesTable.id, { onDelete: "cascade" }),
    fieldId: uuid("field_id").notNull(),
    valueText: text("value_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("catalog_field_values_entry_field_unique").on(t.entryId, t.fieldId)],
);

export type CatalogFieldValueRow = typeof catalogFieldValuesTable.$inferSelect;
export type InsertCatalogFieldValueRow = typeof catalogFieldValuesTable.$inferInsert;
