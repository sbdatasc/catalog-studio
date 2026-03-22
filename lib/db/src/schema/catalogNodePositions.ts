import { pgTable, uuid, decimal, timestamp, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { catalogsTable } from "./catalogs";

export const catalogNodePositionsTable = pgTable(
  "catalog_node_positions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    catalogId: uuid("catalog_id")
      .notNull()
      .references(() => catalogsTable.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").notNull(),
    x: decimal("x", { precision: 10, scale: 2 }).notNull(),
    y: decimal("y", { precision: 10, scale: 2 }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("catalog_node_positions_catalog_template_unique").on(
      t.catalogId,
      t.templateId,
    ),
  ],
);

export type CatalogNodePositionRow = typeof catalogNodePositionsTable.$inferSelect;
export type InsertCatalogNodePositionRow = typeof catalogNodePositionsTable.$inferInsert;
