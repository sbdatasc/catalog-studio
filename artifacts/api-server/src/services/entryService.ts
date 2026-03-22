import { eq, and } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogFieldValuesTable,
  catalogEntryRelationshipsTable,
  schemaVersionsTable,
  type AttributeType,
  type SchemaSnapshot,
  type SnapshotAttribute,
  type SnapshotTemplate,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { getCurrentPublishedSchema } from "./templateService";
import {
  toStorageString,
  fromStorageString,
  validateAttributeValue,
} from "./coercionService";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface AttributeValue {
  attributeId: string;
  attributeName: string;
  attributeType: AttributeType;
  value: unknown;
}

export interface CatalogEntry {
  id: string;
  templateId: string;
  templateSlug: string;
  schemaVersionId: string;
  displayName: string | null;
  attributeValues: AttributeValue[];
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
  templateId: string;
  attributeValues?: Record<string, unknown>;
}

export interface UpdateEntryInput {
  attributeValues?: Record<string, unknown>;
}

export interface ListEntriesFilter {
  templateId?: string;
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

function getTemplateFromSnapshot(snapshot: SchemaSnapshot, templateId: string): SnapshotTemplate {
  const template = snapshot.templates.find((t) => t.id === templateId);
  if (!template) {
    throw new ServiceError(
      "NOT_FOUND",
      `Template "${templateId}" not found in the published schema`,
    );
  }
  return template;
}

/** Flatten all attributes from all sections of a template */
function getAllAttributes(template: SnapshotTemplate): SnapshotAttribute[] {
  return template.sections.flatMap((s) => s.attributes);
}

async function resolveAttributeValues(
  snapshot: SchemaSnapshot,
  attributes: SnapshotAttribute[],
  inputValues: Record<string, unknown>,
  isCreate: boolean,
): Promise<Array<{ attributeId: string; valueText: string | null }>> {
  const db = getDb();
  const result: Array<{ attributeId: string; valueText: string | null }> = [];

  for (const attr of attributes) {
    const value = inputValues[attr.id] ?? inputValues[attr.slug] ?? null;

    if (isCreate && (value === null || value === undefined) && attr.required) {
      throw new ServiceError("UNPROCESSABLE", `Required attribute "${attr.name}" is missing`);
    }

    if (value !== null && value !== undefined) {
      const validation = validateAttributeValue(value, attr, snapshot);
      if (!validation.valid) {
        throw new ServiceError("UNPROCESSABLE", validation.error ?? "Validation failed");
      }

      // For reference attributes, verify target entry exists and matches the template
      if (attr.attributeType === "reference") {
        const config = attr.config as { targetTemplateId: string } | null;
        const [targetEntry] = await db
          .select({ id: catalogEntriesTable.id, templateId: catalogEntriesTable.templateId })
          .from(catalogEntriesTable)
          .where(eq(catalogEntriesTable.id, String(value)))
          .limit(1);

        if (!targetEntry) {
          throw new ServiceError("NOT_FOUND", `Reference attribute "${attr.name}": target entry "${String(value)}" not found`);
        }

        if (config?.targetTemplateId && targetEntry.templateId !== config.targetTemplateId) {
          throw new ServiceError("UNPROCESSABLE", `Reference attribute "${attr.name}": target entry is not of the expected template type`);
        }
      }

      result.push({
        attributeId: attr.id,
        valueText: toStorageString(value, attr.attributeType),
      });
    } else {
      result.push({ attributeId: attr.id, valueText: null });
    }
  }

  return result;
}

function computeDisplayName(
  attributes: SnapshotAttribute[],
  attrValues: Array<{ attributeId: string; valueText: string | null }>,
): string | null {
  const firstStringAttr = attributes.find(
    (a) => a.attributeType === "string" || a.attributeType === "text",
  );
  if (!firstStringAttr) return null;
  const value = attrValues.find((v) => v.attributeId === firstStringAttr.id);
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

  const template = snapshot.templates.find((t) => t.id === entry.templateId);
  const attributes = template ? getAllAttributes(template) : [];

  const attributeValues: AttributeValue[] = valueRows
    .filter((v) => v.valueText !== null)
    .map((v) => {
      const attr = attributes.find((a) => a.id === v.attributeId);
      return {
        attributeId: v.attributeId,
        attributeName: attr?.name ?? v.attributeId,
        attributeType: (attr?.attributeType ?? "string") as AttributeType,
        value: fromStorageString(v.valueText, (attr?.attributeType ?? "string") as AttributeType),
      };
    });

  return {
    id: entry.id,
    templateId: entry.templateId,
    templateSlug: entry.templateSlug,
    schemaVersionId: entry.schemaVersionId,
    displayName: entry.displayName,
    attributeValues,
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
): Promise<Array<{ id: string; templateId: string; templateSlug: string; displayName: string | null; createdAt: Date; updatedAt: Date }>> {
  const db = getDb();
  const { limit = 50, offset = 0 } = pagination;

  if (filter.templateId) {
    return db
      .select({
        id: catalogEntriesTable.id,
        templateId: catalogEntriesTable.templateId,
        templateSlug: catalogEntriesTable.templateSlug,
        displayName: catalogEntriesTable.displayName,
        createdAt: catalogEntriesTable.createdAt,
        updatedAt: catalogEntriesTable.updatedAt,
      })
      .from(catalogEntriesTable)
      .where(eq(catalogEntriesTable.templateId, filter.templateId))
      .limit(limit)
      .offset(offset);
  }

  return db
    .select({
      id: catalogEntriesTable.id,
      templateId: catalogEntriesTable.templateId,
      templateSlug: catalogEntriesTable.templateSlug,
      displayName: catalogEntriesTable.displayName,
      createdAt: catalogEntriesTable.createdAt,
      updatedAt: catalogEntriesTable.updatedAt,
    })
    .from(catalogEntriesTable)
    .limit(limit)
    .offset(offset);
}

export async function getEntry(id: string): Promise<CatalogEntry> {
  const snapshot = await getPublishedSchemaOrThrow();
  return buildEntryWithValues(id, snapshot);
}

export async function createEntry(input: CreateEntryInput): Promise<CatalogEntry> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  const template = getTemplateFromSnapshot(snapshot, input.templateId);

  const [schemaVersionRow] = await db
    .select({ id: schemaVersionsTable.id })
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.isCurrent, true))
    .limit(1);

  if (!schemaVersionRow) {
    throw new ServiceError("UNPROCESSABLE", "No current schema version found");
  }

  const attributes = getAllAttributes(template);
  const inputValues = input.attributeValues ?? {};

  const resolvedValues = await resolveAttributeValues(snapshot, attributes, inputValues, true);
  const displayName = computeDisplayName(attributes, resolvedValues);

  const [entry] = await db
    .insert(catalogEntriesTable)
    .values({
      templateId: input.templateId,
      templateSlug: template.slug,
      schemaVersionId: schemaVersionRow.id,
      displayName,
    })
    .returning();

  if (resolvedValues.length > 0) {
    await db.insert(catalogFieldValuesTable).values(
      resolvedValues.map((v) => ({
        entryId: entry.id,
        attributeId: v.attributeId,
        valueText: v.valueText,
      })),
    );
  }

  return buildEntryWithValues(entry.id, snapshot);
}

export async function updateEntry(id: string, input: UpdateEntryInput): Promise<CatalogEntry> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

  const [existing] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  const template = getTemplateFromSnapshot(snapshot, existing.templateId);
  const attributes = getAllAttributes(template);
  const inputValues = input.attributeValues ?? {};

  const resolvedValues = await resolveAttributeValues(snapshot, attributes, inputValues, false);
  const displayName = computeDisplayName(attributes, resolvedValues);

  for (const v of resolvedValues) {
    await db
      .insert(catalogFieldValuesTable)
      .values({ entryId: id, attributeId: v.attributeId, valueText: v.valueText, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [catalogFieldValuesTable.entryId, catalogFieldValuesTable.attributeId],
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

  await db.delete(catalogEntriesTable).where(eq(catalogEntriesTable.id, id));
}

// ---------------------------------------------------------------------------
// Entry relationships
// ---------------------------------------------------------------------------

export async function linkEntries(input: LinkEntriesInput): Promise<EntryRelationship> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow();

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

  let validRelationship = false;
  let cardinality: string | undefined;
  for (const t of snapshot.templates) {
    const rel = t.relationships.find((r) => r.id === input.relationshipId);
    if (rel) {
      validRelationship = true;
      cardinality = rel.cardinality;
      break;
    }
  }

  if (!validRelationship) {
    throw new ServiceError("NOT_FOUND", `Relationship "${input.relationshipId}" not found in the published schema`);
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
      throw new ServiceError("CONFLICT", `A link for this 1:1 relationship already exists for entry "${input.fromEntryId}"`);
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

  await db.delete(catalogEntryRelationshipsTable).where(eq(catalogEntryRelationshipsTable.id, linkId));
}

export async function getLinkedEntries(entryId: string, relationshipId: string): Promise<CatalogEntry[]> {
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

  return Promise.all(links.map((l) => buildEntryWithValues(l.toEntryId, snapshot)));
}
