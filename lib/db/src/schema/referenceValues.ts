import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { referenceDatasetsTable } from "./referenceDatasets";

export const referenceValuesTable = pgTable(
  "reference_values",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => referenceDatasetsTable.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 200 }).notNull(),
    value: varchar("value", { length: 200 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("reference_values_dataset_value_unique").on(t.datasetId, t.value)],
);

export type ReferenceValueRow = typeof referenceValuesTable.$inferSelect;
export type InsertReferenceValueRow = typeof referenceValuesTable.$inferInsert;
