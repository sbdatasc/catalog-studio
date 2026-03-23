import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export type CatalogRole =
  | "catalog_admin"
  | "designer"
  | "steward"
  | "viewer"
  | "api_consumer";

export const catalogRolesTable = pgTable(
  "catalog_roles",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    catalogId: uuid("catalog_id").notNull(),
    userId: uuid("user_id").notNull(),
    catalogRole: varchar("catalog_role", { length: 20 }).notNull(),
    assignedBy: uuid("assigned_by"),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("uq_catalog_roles_catalog_user").on(table.catalogId, table.userId)],
);

export type CatalogRoleRow = typeof catalogRolesTable.$inferSelect;
export type InsertCatalogRoleRow = typeof catalogRolesTable.$inferInsert;
