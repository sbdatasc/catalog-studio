import { getDb } from "../../../artifacts/api-server/src/db/connection";
import {
  catalogsTable,
  catalogEntriesTable,
  catalogEntryRelationshipsTable,
  schemaVersionsTable,
  catalogNodePositionsTable,
  schemaRelationshipsTable,
  schemaAttributesTable,
  schemaSectionsTable,
  schemaTemplatesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";

export function setupTestDb(): Promise<void> {
  return Promise.resolve();
}

export function teardownTestDb(): Promise<void> {
  return Promise.resolve();
}

export function getTestDb() {
  return getDb();
}

export async function cleanupTestData(ids: { catalogIds?: string[] }): Promise<void> {
  if (!ids.catalogIds || ids.catalogIds.length === 0) return;
  const db = getDb();
  const { catalogIds } = ids;

  const templateRows = await db
    .select({ id: schemaTemplatesTable.id })
    .from(schemaTemplatesTable)
    .where(inArray(schemaTemplatesTable.catalogId, catalogIds));
  const templateIds = templateRows.map((r) => r.id);

  const sectionRows =
    templateIds.length > 0
      ? await db
          .select({ id: schemaSectionsTable.id })
          .from(schemaSectionsTable)
          .where(inArray(schemaSectionsTable.templateId, templateIds))
      : [];
  const sectionIds = sectionRows.map((r) => r.id);

  const entryRows = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(inArray(catalogEntriesTable.catalogId, catalogIds));
  const entryIds = entryRows.map((r) => r.id);

  if (entryIds.length > 0) {
    await db
      .delete(catalogEntryRelationshipsTable)
      .where(inArray(catalogEntryRelationshipsTable.fromEntryId, entryIds));
    await db
      .delete(catalogEntryRelationshipsTable)
      .where(inArray(catalogEntryRelationshipsTable.toEntryId, entryIds));
    await db.delete(catalogEntriesTable).where(inArray(catalogEntriesTable.id, entryIds));
  }

  await db.delete(schemaVersionsTable).where(inArray(schemaVersionsTable.catalogId, catalogIds));
  await db.delete(catalogNodePositionsTable).where(inArray(catalogNodePositionsTable.catalogId, catalogIds));

  if (templateIds.length > 0) {
    await db
      .delete(schemaRelationshipsTable)
      .where(inArray(schemaRelationshipsTable.fromTemplateId, templateIds));
  }

  if (sectionIds.length > 0) {
    await db.delete(schemaAttributesTable).where(inArray(schemaAttributesTable.sectionId, sectionIds));
  }
  if (templateIds.length > 0) {
    await db.delete(schemaSectionsTable).where(inArray(schemaSectionsTable.templateId, templateIds));
    await db.delete(schemaTemplatesTable).where(inArray(schemaTemplatesTable.id, templateIds));
  }

  await db.delete(catalogsTable).where(inArray(catalogsTable.id, catalogIds));
}
