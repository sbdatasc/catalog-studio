import DataLoader from "dataloader";
import { inArray, and } from "drizzle-orm";
import { catalogEntryRelationshipsTable, catalogFieldValuesTable } from "@workspace/db";
import type { DbClient } from "./context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipLoaderKey {
  fromEntryId: string;
  relationshipId: string;
}

export interface RelationshipLink {
  fromEntryId: string;
  toEntryId: string;
  relationshipId: string;
}

export interface FieldValueRow {
  attributeId: string;
  value: string | null;
}

export interface DataLoaders {
  relationshipLinks: DataLoader<RelationshipLoaderKey, RelationshipLink[], string>;
  entryFieldValues: DataLoader<string, FieldValueRow[]>;
}

// ---------------------------------------------------------------------------
// Batch functions
// ---------------------------------------------------------------------------

async function batchLoadRelationshipLinks(
  db: DbClient,
  keys: readonly RelationshipLoaderKey[],
): Promise<RelationshipLink[][]> {
  if (keys.length === 0) return [];

  const fromEntryIds = [...new Set(keys.map((k) => k.fromEntryId))];
  const relationshipIds = [...new Set(keys.map((k) => k.relationshipId))];

  const links = await db
    .select({
      fromEntryId: catalogEntryRelationshipsTable.fromEntryId,
      toEntryId: catalogEntryRelationshipsTable.toEntryId,
      relationshipId: catalogEntryRelationshipsTable.relationshipId,
    })
    .from(catalogEntryRelationshipsTable)
    .where(
      and(
        inArray(catalogEntryRelationshipsTable.fromEntryId, fromEntryIds),
        inArray(catalogEntryRelationshipsTable.relationshipId, relationshipIds),
      ),
    );

  // Return results in exact key order — DataLoader requires this
  return keys.map((key) =>
    links.filter(
      (l) => l.fromEntryId === key.fromEntryId && l.relationshipId === key.relationshipId,
    ),
  );
}

async function batchLoadFieldValues(
  db: DbClient,
  entryIds: readonly string[],
): Promise<FieldValueRow[][]> {
  if (entryIds.length === 0) return [];

  const allValues = await db
    .select({
      entryId: catalogFieldValuesTable.entryId,
      attributeId: catalogFieldValuesTable.attributeId,
      value: catalogFieldValuesTable.valueText,
    })
    .from(catalogFieldValuesTable)
    .where(inArray(catalogFieldValuesTable.entryId, [...entryIds]));

  // Group by entryId and return in original entryIds order
  return entryIds.map((id) =>
    allValues
      .filter((v) => v.entryId === id)
      .map((v) => ({ attributeId: v.attributeId, value: v.value })),
  );
}

// ---------------------------------------------------------------------------
// Factory — call once per request, never share across requests
// ---------------------------------------------------------------------------

export function createDataLoaders(db: DbClient): DataLoaders {
  return {
    relationshipLinks: new DataLoader<RelationshipLoaderKey, RelationshipLink[], string>(
      (keys) => batchLoadRelationshipLinks(db, keys),
      { cacheKeyFn: (k) => `${k.fromEntryId}:${k.relationshipId}` },
    ),
    entryFieldValues: new DataLoader<string, FieldValueRow[]>(
      (entryIds) => batchLoadFieldValues(db, entryIds),
    ),
  };
}
