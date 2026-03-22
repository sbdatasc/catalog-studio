import { eq, and, ilike } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogFieldValuesTable,
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
  validateAttributeValue,
  toDisplayString,
} from "./coercionService";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface FieldValue {
  attributeId: string;
  attributeName: string;
  attributeType: AttributeType;
  value: string | null;
  displayValue: string | null;
}

export interface CatalogEntry {
  id: string;
  catalogId: string;
  templateId: string;
  templateName: string;
  schemaVersionId: string;
  displayName: string;
  fieldValues: FieldValue[];
  createdAt: string;
  updatedAt: string;
}

export interface EntryListItem {
  id: string;
  catalogId: string;
  templateId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEntryInput {
  catalogId: string;
  templateId: string;
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getPublishedSchemaOrThrow(catalogId: string): Promise<SchemaSnapshot> {
  const version = await getCurrentPublishedSchema(catalogId);
  if (!version) {
    throw new ServiceError(
      "UNPROCESSABLE",
      "No published schema exists. Publish the schema before creating entries.",
    );
  }
  return version.snapshot as SchemaSnapshot;
}

function getTemplateFromSnapshot(snapshot: SchemaSnapshot, templateId: string): SnapshotTemplate {
  const template = snapshot.templates.find((t: SnapshotTemplate) => t.id === templateId);
  if (!template) {
    throw new ServiceError(
      "NOT_FOUND",
      `Template "${templateId}" not found in the published schema`,
    );
  }
  return template;
}

function getAllAttributes(template: SnapshotTemplate): SnapshotAttribute[] {
  return template.sections
    .slice()
    .sort((a: { displayOrder: number }, b: { displayOrder: number }) => a.displayOrder - b.displayOrder)
    .flatMap((s: { attributes: SnapshotAttribute[] }) =>
      s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder),
    );
}

function computeDisplayName(
  templateName: string,
  entryId: string,
  attributes: SnapshotAttribute[],
  attrValues: Array<{ attributeId: string; valueText: string | null }>,
): string {
  const firstStringAttr = attributes.find(
    (a) => a.attributeType === "string" || a.attributeType === "text",
  );
  if (firstStringAttr) {
    const val = attrValues.find((v) => v.attributeId === firstStringAttr.id);
    if (val?.valueText && val.valueText.trim().length > 0) {
      return val.valueText.trim();
    }
  }
  return `Untitled ${templateName} #${entryId.substring(0, 8)}`;
}

async function resolveReferenceDisplayName(entryId: string): Promise<string | null> {
  const db = getDb();
  const [entry] = await db
    .select({ displayName: catalogEntriesTable.displayName })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, entryId))
    .limit(1);
  return entry?.displayName ?? null;
}

async function buildCatalogEntry(
  entryId: string,
  snapshot: SchemaSnapshot,
): Promise<CatalogEntry> {
  const db = getDb();

  const [entryRow] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, entryId))
    .limit(1);

  if (!entryRow) {
    throw new ServiceError("NOT_FOUND", `Entry "${entryId}" not found`);
  }

  const template = snapshot.templates.find((t: SnapshotTemplate) => t.id === entryRow.templateId);
  const attributes: SnapshotAttribute[] = template ? getAllAttributes(template) : [];

  const valueRows = await db
    .select()
    .from(catalogFieldValuesTable)
    .where(eq(catalogFieldValuesTable.entryId, entryId));

  const fieldValues: FieldValue[] = [];
  for (const attr of attributes) {
    const row = valueRows.find((v) => v.attributeId === attr.id);
    const valueText = row?.valueText ?? null;

    let displayValue: string | null;
    if (
      (attr.attributeType === "reference" || attr.attributeType === "reference_data") &&
      valueText
    ) {
      displayValue = await resolveReferenceDisplayName(valueText);
    } else {
      displayValue = toDisplayString(valueText, attr.attributeType);
    }

    fieldValues.push({
      attributeId: attr.id,
      attributeName: attr.name,
      attributeType: attr.attributeType,
      value: valueText,
      displayValue,
    });
  }

  return {
    id: entryRow.id,
    catalogId: entryRow.catalogId,
    templateId: entryRow.templateId,
    templateName: template?.name ?? "",
    schemaVersionId: entryRow.schemaVersionId,
    displayName: entryRow.displayName ?? `Untitled #${entryRow.id.substring(0, 8)}`,
    fieldValues,
    createdAt: entryRow.createdAt.toISOString(),
    updatedAt: entryRow.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Entry CRUD — O-01 compliant
// ---------------------------------------------------------------------------

export async function createEntry(input: CreateEntryInput): Promise<CatalogEntry> {
  const db = getDb();
  const snapshot = await getPublishedSchemaOrThrow(input.catalogId);
  const template = getTemplateFromSnapshot(snapshot, input.templateId);

  const [schemaVersionRow] = await db
    .select({ id: schemaVersionsTable.id })
    .from(schemaVersionsTable)
    .where(
      and(
        eq(schemaVersionsTable.catalogId, input.catalogId),
        eq(schemaVersionsTable.isCurrent, true),
      ),
    )
    .limit(1);

  if (!schemaVersionRow) {
    throw new ServiceError("UNPROCESSABLE", "No current schema version found");
  }

  const attributes = getAllAttributes(template);
  const inputMap = new Map(input.fieldValues.map((fv) => [fv.attributeId, fv.value]));

  const resolvedValues: Array<{ attributeId: string; valueText: string | null }> = [];

  for (const attr of attributes) {
    const rawValue = inputMap.has(attr.id) ? inputMap.get(attr.id) : null;
    const value: string | null = rawValue ?? null;

    if (attr.required && (value === null || value === "")) {
      throw new ServiceError(
        "REQUIRED_FIELD_MISSING",
        `Required field "${attr.name}" is missing`,
        // Store attributeId so route handler can pass it to client
      );
    }

    if (value !== null && value !== "") {
      const validation = validateAttributeValue(value, attr);
      if (!validation.valid) {
        if (attr.required && (value === null || value === "")) {
          throw new ServiceError("REQUIRED_FIELD_MISSING", validation.error ?? "Required field missing");
        }
        throw new ServiceError("VALIDATION_ERROR", validation.error ?? "Validation failed");
      }

      if (attr.attributeType === "reference" || attr.attributeType === "reference_data") {
        const config = attr.config as { targetTemplateId?: string } | null;
        const [targetEntry] = await db
          .select({ id: catalogEntriesTable.id, templateId: catalogEntriesTable.templateId })
          .from(catalogEntriesTable)
          .where(eq(catalogEntriesTable.id, value))
          .limit(1);

        if (!targetEntry) {
          throw new ServiceError(
            "REFERENCE_NOT_FOUND",
            `The selected entry for "${attr.name}" no longer exists`,
          );
        }

        if (config?.targetTemplateId && targetEntry.templateId !== config.targetTemplateId) {
          throw new ServiceError(
            "REFERENCE_NOT_FOUND",
            `Entry for "${attr.name}" is not of the expected template type`,
          );
        }
      }

      resolvedValues.push({ attributeId: attr.id, valueText: toStorageString(value, attr.attributeType) });
    } else {
      resolvedValues.push({ attributeId: attr.id, valueText: null });
    }
  }

  // Insert entry with a placeholder id to compute display name
  const [inserted] = await db
    .insert(catalogEntriesTable)
    .values({
      catalogId: input.catalogId,
      templateId: input.templateId,
      templateSlug: template.slug,
      schemaVersionId: schemaVersionRow.id,
      displayName: null,
    })
    .returning();

  const displayName = computeDisplayName(template.name, inserted.id, attributes, resolvedValues);

  await db
    .update(catalogEntriesTable)
    .set({ displayName })
    .where(eq(catalogEntriesTable.id, inserted.id));

  if (resolvedValues.length > 0) {
    await db.insert(catalogFieldValuesTable).values(
      resolvedValues.map((v) => ({
        entryId: inserted.id,
        attributeId: v.attributeId,
        valueText: v.valueText,
      })),
    );
  }

  return buildCatalogEntry(inserted.id, snapshot);
}

export async function listEntries(
  catalogId: string,
  templateId: string,
): Promise<EntryListItem[]> {
  const db = getDb();

  const rows = await db
    .select({
      id: catalogEntriesTable.id,
      catalogId: catalogEntriesTable.catalogId,
      templateId: catalogEntriesTable.templateId,
      displayName: catalogEntriesTable.displayName,
      createdAt: catalogEntriesTable.createdAt,
      updatedAt: catalogEntriesTable.updatedAt,
    })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.catalogId, catalogId),
        eq(catalogEntriesTable.templateId, templateId),
      ),
    );

  return rows.map((r) => ({
    id: r.id,
    catalogId: r.catalogId,
    templateId: r.templateId,
    displayName: r.displayName ?? `Untitled #${r.id.substring(0, 8)}`,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function searchEntries(
  catalogId: string,
  templateId: string,
  q: string,
  limit = 10,
): Promise<EntryListItem[]> {
  const db = getDb();
  const safeLimit = Math.min(Math.max(1, limit), 50);

  const rows = await db
    .select({
      id: catalogEntriesTable.id,
      catalogId: catalogEntriesTable.catalogId,
      templateId: catalogEntriesTable.templateId,
      displayName: catalogEntriesTable.displayName,
      createdAt: catalogEntriesTable.createdAt,
      updatedAt: catalogEntriesTable.updatedAt,
    })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.catalogId, catalogId),
        eq(catalogEntriesTable.templateId, templateId),
        ilike(catalogEntriesTable.displayName, `%${q}%`),
      ),
    )
    .limit(safeLimit);

  return rows.map((r) => ({
    id: r.id,
    catalogId: r.catalogId,
    templateId: r.templateId,
    displayName: r.displayName ?? `Untitled #${r.id.substring(0, 8)}`,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}
