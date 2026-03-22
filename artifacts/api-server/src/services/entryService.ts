import { eq, and } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogFieldValuesTable,
  catalogEntryRelationshipsTable,
  schemaVersionsTable,
  type FieldType,
  type SchemaSnapshot,
  type SnapshotField,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { getCurrentPublishedSchema } from "./schemaService";
import {
  toStorageString,
  fromStorageString,
  validateFieldValue,
} from "./coercionService";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface FieldValue {
  fieldId: string;
  fieldName: string;
  fieldType: FieldType;
  value: unknown;
}

export interface CatalogEntry {
  id: string;
  entityTypeId: string;
  entityTypeSlug: string;
  schemaVersionId: string;
  displayName: string | null;
  fieldValues: FieldValue[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EntryRelationship {
  id: string;
  fromEntryId: string;
  toEntryId: string;
  relationshipId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEntryInput {
  entityTypeId: string;
  fieldValues?: Record<string, unknown>;
}

export interface UpdateEntryInput {
  fieldValues?: Record<string, unknown>;
}

export interface ListEntriesFilter {
  entityTypeId?: string;
}

export interface ListEntriesPagination {
  limit?: number;
  offset?: number;
}

export interface LinkEntriesInput {
  fromEntryId: string;
  toEntryId: string;
  relationshipId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPublishedSchemaOrThrow(): Promise<SchemaSnapshot> {
  return getCurrentPublishedSchema().then((v) => {
    if (!v) {
      throw new ServiceError(
        "UNPROCESSABLE",
        "No published schema exists. Publish the schema before creating entries.",
      );
    }
    return v.snapshot;
  });
}

function getEntityTypeFromSnapshot(
  snapshot: SchemaSnapshot,
  entityTypeId: string,
) {
  const et = snapshot.entityTypes.find((e) => e.id === entityTypeId);
  if (!et) {
    throw new ServiceError(
      "NOT_FOUND",
      `Entity type "${entityTypeId}" not found in the published schema`,
    );
  }
  return et;
}

async function resolveFieldValues(
  snapshot: SchemaSnapshot,
  fields: SnapshotField[],
  inputValues: Record<string, unknown>,
  entryId: string,
  isCreate: boolean,
): Promise<Array<{ fieldId: string; valueText: string | null }>> {
  const db = getDb();
  const result: Array<{ fieldId: string; valueText: string | null }> = [];

  for (const field of fields) {
    const value = inputValues[field.id] ?? inputValues[field.slug] ?? null;

    // On create, validate required fields
    if (isCreate && (value === null || value === undefined) && field.required) {
      throw new ServiceError(
        "UNPROCESSABLE",
        `Required field "${field.name}" is missing`,
      );
    }

    if (value !== null && value !== undefined) {
      const validation = validateFieldValue(value, field, snapshot);
      if (!validation.valid) {
        throw new ServiceError("UNPROCESSABLE", validation.error ?? "Validation failed");
      }

      // For reference fields, verify the target entry exists and matches the entity type
      if (field.fieldType === "reference") {
        const config = field.config as { targetEntityTypeId: string } | null;
        const [targetEntry] = await db
          .select({ id: catalogEntriesTable.id, entityTypeId: catalogEntriesTable.entityTypeId })
          .from(catalogEntriesTable)
          .where(eq(catalogEntriesTable.id, String(value)))
          .limit(1);

        if (!targetEntry) {
          throw new ServiceError(
            "NOT_FOUND",
            `Reference field "${field.name}": target entry "${String(value)}" not found`,
          );
        }

        if (config?.targetEntityTypeId && targetEntry.entityTypeId !== config.targetEntityTypeId) {
          throw new ServiceError(
            "UNPROCESSABLE",
            `Reference field "${field.name}": target entry is not of the expected entity type`,
          );
        }
      }

      result.push({
        fieldId: field.id,
        valueText: toStorageString(value, field.fieldType),
      });
    } else {
      result.push({ fieldId: field.id, valueText: null });
    }
  }

  return result;
}

function computeDisplayName(
  fields: SnapshotField[],
  fieldValues: Array<{ fieldId: string; valueText: string | null }>,
): string | null {
  const firstStringField = fields.find(
    (f) => f.fieldType === "string" || f.fieldType === "text",
  );
  if (!firstStringField) return null;
  const value = fieldValues.find((v) => v.fieldId === firstStringField.id);
  return value?.valueText ?? null;
}

async function buildEntryWithValues(entryId: string, snapshot: SchemaSnapshot): Promise<CatalogEntry> {
  const db = getDb();

  const [entry] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, entryId))
    .limit(1);

  if (!entry) {
    throw new ServiceError("NOT_FOUND", `Entry "${entryId}" not found`);
  }

  const valueRows = await db
    .select()
    .from(catalogFieldValuesTable)
    .where(eq(catalogFieldValuesTable.entryId, entryId));

  const entityType = snapshot.entityTypes.find((e) => e.id === entry.entityTypeId);
  const fields = entityType?.fields ?? [];

  const fieldValues: FieldValue[] = valueRows
    .filter((v) => v.valueText !== null)
    .map((v) => {
      const field = fields.find((f) => f.id === v.fieldId);
      return {
        fieldId: v.fieldId,
        fieldName: field?.name ?? v.fieldId,
        fieldType: (field?.fieldType ?? "string") as FieldType,
        value: fromStorageString(v.valueText, (field?.fieldType ?? "string") as FieldType),
      };
    });

  return {
    id: entry.id,
    entityTypeId: entry.entityTypeId,
    entityTypeSlug: entry.entityTypeSlug,
    schemaVersionId: entry.schemaVersionId,
    displayName: entry.displayName,
    fieldValues,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Entry CRUD
// ---------------------------------------------------------------------------

export async function listEntries(
  filter: ListEntriesFilter = {},
  pagination: ListEntriesPagination = {},
): Promise<Array<{ id: string; entityTypeId: string; entityTypeSlug: string; displayName: string | null; createdAt: Date; updatedAt: Date }>> {
  const db = getDb();
  const { limit = 50, offset = 0 } = pagination;

  let query = db.select({
    id: catalogEntriesTable.id,
    entityTypeId: catalogEntriesTable.entityTypeId,
    entityTypeSlug: catalogEntriesTable.entityTypeSlug,
    displayName: catalogEntriesTable.displayName,
    createdAt: catalogEntriesTable.createdAt,
    updatedAt: catalogEntriesTable.updatedAt,
  }).from(catalogEntriesTable);

  if (filter.entityTypeId) {
    const rows = await db.select({
      id: catalogEntriesTable.id,
      entityTypeId: catalogEntriesTable.entityTypeId,
      entityTypeSlug: catalogEntriesTable.entityTypeSlug,
      displayName: catalogEntriesTable.displayName,
      createdAt: catalogEntriesTable.createdAt,
      updatedAt: catalogEntriesTable.updatedAt,
    })
      .from(catalogEntriesTable)
      .where(eq(catalogEntriesTable.entityTypeId, filter.entityTypeId))
      .limit(limit)
      .offset(offset);
    return rows;
  }

  return query.limit(limit).offset(offset);
}

export async function getEntry(id: string): Promise<CatalogEntry> {
  const snapshot = await getPublishedSchemaOrThrow();
  return buildEntryWithValues(id, snapshot);
}

export async function createEntry(input: CreateEntryInput): Promise<CatalogEntry> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  const entityType = getEntityTypeFromSnapshot(snapshot, input.entityTypeId);

  // Get the current schema version id
  const [schemaVersionRow] = await db
    .select({ id: schemaVersionsTable.id })
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.isCurrent, true))
    .limit(1);

  if (!schemaVersionRow) {
    throw new ServiceError("UNPROCESSABLE", "No current schema version found");
  }

  const inputValues = input.fieldValues ?? {};
  const resolvedValues = await resolveFieldValues(
    snapshot,
    entityType.fields,
    inputValues,
    "",
    true,
  );

  const displayName = computeDisplayName(entityType.fields, resolvedValues);

  const [entry] = await db
    .insert(catalogEntriesTable)
    .values({
      entityTypeId: input.entityTypeId,
      entityTypeSlug: entityType.slug,
      schemaVersionId: schemaVersionRow.id,
      displayName,
    })
    .returning();

  // Insert field values
  if (resolvedValues.length > 0) {
    await db.insert(catalogFieldValuesTable).values(
      resolvedValues.map((v) => ({
        entryId: entry.id,
        fieldId: v.fieldId,
        valueText: v.valueText,
      })),
    );
  }

  return buildEntryWithValues(entry.id, snapshot);
}

export async function updateEntry(
  id: string,
  input: UpdateEntryInput,
): Promise<CatalogEntry> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  // Verify entry exists
  const [existing] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  const entityType = getEntityTypeFromSnapshot(snapshot, existing.entityTypeId);
  const inputValues = input.fieldValues ?? {};

  const resolvedValues = await resolveFieldValues(
    snapshot,
    entityType.fields,
    inputValues,
    id,
    false,
  );

  const displayName = computeDisplayName(entityType.fields, resolvedValues);

  // Update each field value (upsert)
  for (const v of resolvedValues) {
    await db
      .insert(catalogFieldValuesTable)
      .values({ entryId: id, fieldId: v.fieldId, valueText: v.valueText, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [catalogFieldValuesTable.entryId, catalogFieldValuesTable.fieldId],
        set: { valueText: v.valueText, updatedAt: new Date() },
      });
  }

  await db
    .update(catalogEntriesTable)
    .set({ displayName, updatedAt: new Date() })
    .where(eq(catalogEntriesTable.id, id));

  return buildEntryWithValues(id, snapshot);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  // Cascade handled by DB: field values and entry relationships deleted automatically
  await db
    .delete(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id));
}

// ---------------------------------------------------------------------------
// Entry relationships
// ---------------------------------------------------------------------------

export async function linkEntries(input: LinkEntriesInput): Promise<EntryRelationship> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  // Validate both entries exist
  for (const entryId of [input.fromEntryId, input.toEntryId]) {
    const [entry] = await db
      .select({ id: catalogEntriesTable.id })
      .from(catalogEntriesTable)
      .where(eq(catalogEntriesTable.id, entryId))
      .limit(1);
    if (!entry) {
      throw new ServiceError("NOT_FOUND", `Entry "${entryId}" not found`);
    }
  }

  // Validate relationship exists in the published schema
  let validRelationship = false;
  for (const et of snapshot.entityTypes) {
    if (et.relationships.some((r) => r.id === input.relationshipId)) {
      validRelationship = true;
      break;
    }
  }
  if (!validRelationship) {
    throw new ServiceError(
      "NOT_FOUND",
      `Relationship "${input.relationshipId}" not found in the published schema`,
    );
  }

  // Check cardinality for 1:1 — only one link per relationship per entry
  let cardinality: string | undefined;
  for (const et of snapshot.entityTypes) {
    const rel = et.relationships.find((r) => r.id === input.relationshipId);
    if (rel) {
      cardinality = rel.cardinality;
      break;
    }
  }

  if (cardinality === "1:1") {
    const [existingLink] = await db
      .select({ id: catalogEntryRelationshipsTable.id })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.fromEntryId, input.fromEntryId),
          eq(catalogEntryRelationshipsTable.relationshipId, input.relationshipId),
        ),
      )
      .limit(1);

    if (existingLink) {
      throw new ServiceError(
        "CONFLICT",
        `A link for this 1:1 relationship already exists for entry "${input.fromEntryId}"`,
      );
    }
  }

  const [link] = await db
    .insert(catalogEntryRelationshipsTable)
    .values({
      fromEntryId: input.fromEntryId,
      toEntryId: input.toEntryId,
      relationshipId: input.relationshipId,
    })
    .returning();

  return link;
}

export async function unlinkEntries(linkId: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select({ id: catalogEntryRelationshipsTable.id })
    .from(catalogEntryRelationshipsTable)
    .where(eq(catalogEntryRelationshipsTable.id, linkId))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Relationship link "${linkId}" not found`);
  }

  await db
    .delete(catalogEntryRelationshipsTable)
    .where(eq(catalogEntryRelationshipsTable.id, linkId));
}

export async function getLinkedEntries(
  entryId: string,
  relationshipId: string,
): Promise<CatalogEntry[]> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  const links = await db
    .select({ toEntryId: catalogEntryRelationshipsTable.toEntryId })
    .from(catalogEntryRelationshipsTable)
    .where(
      and(
        eq(catalogEntryRelationshipsTable.fromEntryId, entryId),
        eq(catalogEntryRelationshipsTable.relationshipId, relationshipId),
      ),
    );

  if (links.length === 0) return [];

  const entries = await Promise.all(
    links.map((l) => buildEntryWithValues(l.toEntryId, snapshot)),
  );

  return entries;
}
