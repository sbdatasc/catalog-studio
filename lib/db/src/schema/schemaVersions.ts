import {
  pgTable,
  uuid,
  integer,
  varchar,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { SchemaSnapshot } from "../types";

export const schemaVersionsTable = pgTable("schema_versions", {
  id: uuid("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  versionNumber: integer("version_number").notNull(),
  snapshot: jsonb("snapshot").notNull().$type<SchemaSnapshot>(),
  publishedBy: varchar("published_by", { length: 100 }),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isCurrent: boolean("is_current").notNull().default(true),
});

export type SchemaVersionRow = typeof schemaVersionsTable.$inferSelect;
export type InsertSchemaVersionRow = typeof schemaVersionsTable.$inferInsert;
