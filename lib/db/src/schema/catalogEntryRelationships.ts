import { pgTable, uuid, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { catalogEntriesTable } from "./catalogEntries";

export const catalogEntryRelationshipsTable = pgTable(
  "catalog_entry_relationships",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    fromEntryId: uuid("from_entry_id")
      .notNull()
      .references(() => catalogEntriesTable.id, { onDelete: "cascade" }),
    toEntryId: uuid("to_entry_id")
      .notNull()
      .references(() => catalogEntriesTable.id, { onDelete: "cascade" }),
    relationshipId: uuid("relationship_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("catalog_entry_relationships_unique").on(
      t.fromEntryId,
      t.toEntryId,
      t.relationshipId,
    ),
  ],
);

export type CatalogEntryRelationshipRow =
  typeof catalogEntryRelationshipsTable.$inferSelect;
export type InsertCatalogEntryRelationshipRow =
  typeof catalogEntryRelationshipsTable.$inferInsert;
