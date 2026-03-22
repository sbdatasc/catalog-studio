import {
  pgTable,
  uuid,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { schemaVersionsTable } from "./schemaVersions";

export const catalogEntriesTable = pgTable("catalog_entries", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  entityTypeId: uuid("entity_type_id").notNull(),
  entityTypeSlug: varchar("entity_type_slug", { length: 100 }).notNull(),
  schemaVersionId: uuid("schema_version_id")
    .notNull()
    .references(() => schemaVersionsTable.id),
  displayName: varchar("display_name", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type CatalogEntryRow = typeof catalogEntriesTable.$inferSelect;
export type InsertCatalogEntryRow = typeof catalogEntriesTable.$inferInsert;
