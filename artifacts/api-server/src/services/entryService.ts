import { eq, and, ilike, desc, sql, or, inArray } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogFieldValuesTable,
  catalogEntryRelationshipsTable,
  catalogsTable,
  schemaVersionsTable,
  type AttributeType,
  type SchemaSnapshot,
  type SnapshotAttribute,
  type SnapshotRelationship,
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

export interface PaginatedEntries {
  entries: EntryListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface EntryLinkInstance {
  id: string;
  relationshipId: string;
  relationshipLabel: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
  fromEntryId: string;
  fromEntryName: string;
  fromTemplateId: string;
  toEntryId: string;
  toEntryName: string;
  toTemplateId: string;
  toTemplateName: string;
  createdAt: string;
}

export interface LinkEntriesInput {
  fromEntryId: string;
  toEntryId: string;
  relationshipId: string;
}

// ---------------------------------------------------------------------------
// O-05 — Bulk Link types
// ---------------------------------------------------------------------------

export interface BulkLinkEntry {
  entryId: string;
  displayName: string;
  reason?: string;
}

export interface BulkLinkResult {
  attempted: number;
  succeeded: BulkLinkEntry[];
  skipped: BulkLinkEntry[];
  failed: BulkLinkEntry[];
}

export interface BulkLinkInput {
  fromEntryIds: string[];
  toEntryId: string;
  relationshipId: string;
}

// ---------------------------------------------------------------------------
// O-04 — Filter types
// ---------------------------------------------------------------------------

export type FilterOperator =
  | "eq"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "before"
  | "after"
  | "in"
  | "isEmpty"
  | "isNotEmpty";

export const FILTER_OPERATORS: FilterOperator[] = [
  "eq",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
  "in",
  "isEmpty",
  "isNotEmpty",
];

export interface EntryFilter {
  attributeId: string;
  operator: FilterOperator;
  value: string | null;
}

function matchesOperator(valueText: string, operator: FilterOperator, filterValue: string): boolean {
  const v = valueText.toLowerCase();
  const f = filterValue.toLowerCase();
  switch (operator) {
    case "eq":
      return v === f;
    case "contains":
      return v.includes(f);
    case "startsWith":
      return v.startsWith(f);
    case "endsWith":
      return v.endsWith(f);
    case "gt": {
      const n = parseFloat(valueText);
      const fn = parseFloat(filterValue);
      return !isNaN(n) && !isNaN(fn) && n > fn;
    }
    case "gte": {
      const n = parseFloat(valueText);
      const fn = parseFloat(filterValue);
      return !isNaN(n) && !isNaN(fn) && n >= fn;
    }
    case "lt": {
      const n = parseFloat(valueText);
      const fn = parseFloat(filterValue);
      return !isNaN(n) && !isNaN(fn) && n < fn;
    }
    case "lte": {
      const n = parseFloat(valueText);
      const fn = parseFloat(filterValue);
      return !isNaN(n) && !isNaN(fn) && n <= fn;
    }
    case "before":
      return new Date(valueText) < new Date(filterValue);
    case "after":
      return new Date(valueText) > new Date(filterValue);
    case "in": {
      const vals = filterValue.split(",").map((s) => s.trim().toLowerCase());
      return vals.includes(v);
    }
    default:
      return true;
  }
}

async function applyEntryFilter(
  entryIds: string[],
  filter: EntryFilter,
  db: ReturnType<typeof getDb>,
): Promise<string[]> {
  if (entryIds.length === 0) return [];

  const { attributeId, operator, value } = filter;

  if (operator === "isEmpty") {
    const hasValues = await db
      .select({ entryId: catalogFieldValuesTable.entryId })
      .from(catalogFieldValuesTable)
      .where(
        and(
          inArray(catalogFieldValuesTable.entryId, entryIds),
          eq(catalogFieldValuesTable.attributeId, attributeId),
          sql`${catalogFieldValuesTable.valueText} IS NOT NULL`,
        ),
      );
    const hasSet = new Set(hasValues.map((r) => r.entryId));
    return entryIds.filter((id) => !hasSet.has(id));
  }

  if (operator === "isNotEmpty") {
    const hasValues = await db
      .select({ entryId: catalogFieldValuesTable.entryId })
      .from(catalogFieldValuesTable)
      .where(
        and(
          inArray(catalogFieldValuesTable.entryId, entryIds),
          eq(catalogFieldValuesTable.attributeId, attributeId),
          sql`${catalogFieldValuesTable.valueText} IS NOT NULL`,
        ),
      );
    const hasSet = new Set(hasValues.map((r) => r.entryId));
    return entryIds.filter((id) => hasSet.has(id));
  }

  if (value === null || value === "") return entryIds;

  const valueRows = await db
    .select({
      entryId: catalogFieldValuesTable.entryId,
      valueText: catalogFieldValuesTable.valueText,
    })
    .from(catalogFieldValuesTable)
    .where(
      and(
        inArray(catalogFieldValuesTable.entryId, entryIds),
        eq(catalogFieldValuesTable.attributeId, attributeId),
      ),
    );

  const matching = new Set<string>();
  for (const row of valueRows) {
    if (row.valueText === null) continue;
    if (matchesOperator(row.valueText, operator, value)) {
      matching.add(row.entryId);
    }
  }

  return entryIds.filter((id) => matching.has(id));
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateEntryInput {
  catalogId: string;
  templateId: string;
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

export interface UpdateEntryInput {
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

async function validateAndResolveFieldValues(
  attributes: SnapshotAttribute[],
  inputMap: Map<string, string | null>,
  db: ReturnType<typeof getDb>,
): Promise<Array<{ attributeId: string; valueText: string | null }>> {
  const resolvedValues: Array<{ attributeId: string; valueText: string | null }> = [];

  for (const attr of attributes) {
    const rawValue = inputMap.has(attr.id) ? inputMap.get(attr.id) : null;
    const value: string | null = rawValue ?? null;

    if (attr.required && (value === null || value === "")) {
      throw new ServiceError(
        "REQUIRED_FIELD_MISSING",
        `Required field "${attr.name}" is missing`,
      );
    }

    if (value !== null && value !== "") {
      const validation = validateAttributeValue(value, attr);
      if (!validation.valid) {
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

      resolvedValues.push({
        attributeId: attr.id,
        valueText: toStorageString(value, attr.attributeType),
      });
    } else {
      resolvedValues.push({ attributeId: attr.id, valueText: null });
    }
  }

  return resolvedValues;
}

// ---------------------------------------------------------------------------
// Entry CRUD — O-01 compliant
// ---------------------------------------------------------------------------

export async function getCatalogIdForEntry(entryId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: catalogEntriesTable.catalogId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, entryId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Entry "${entryId}" not found`);
  return row.catalogId;
}

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

  const resolvedValues = await validateAndResolveFieldValues(attributes, inputMap, db);

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

// ---------------------------------------------------------------------------
// O-02 additions
// ---------------------------------------------------------------------------

export async function getEntry(id: string): Promise<CatalogEntry> {
  const db = getDb();

  const [entryRow] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!entryRow) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  const snapshot = await getPublishedSchemaOrThrow(entryRow.catalogId);
  return buildCatalogEntry(id, snapshot);
}

export async function updateEntry(id: string, input: UpdateEntryInput): Promise<CatalogEntry> {
  const db = getDb();

  const [entryRow] = await db
    .select()
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!entryRow) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  const snapshot = await getPublishedSchemaOrThrow(entryRow.catalogId);
  const template = getTemplateFromSnapshot(snapshot, entryRow.templateId);
  const attributes = getAllAttributes(template);
  const inputMap = new Map(input.fieldValues.map((fv) => [fv.attributeId, fv.value]));

  const resolvedValues = await validateAndResolveFieldValues(attributes, inputMap, db);

  const newDisplayName = computeDisplayName(template.name, entryRow.id, attributes, resolvedValues);

  await db
    .update(catalogEntriesTable)
    .set({ displayName: newDisplayName, updatedAt: new Date() })
    .where(eq(catalogEntriesTable.id, id));

  for (const rv of resolvedValues) {
    await db
      .insert(catalogFieldValuesTable)
      .values({
        entryId: id,
        attributeId: rv.attributeId,
        valueText: rv.valueText,
      })
      .onConflictDoUpdate({
        target: [catalogFieldValuesTable.entryId, catalogFieldValuesTable.attributeId],
        set: { valueText: rv.valueText, updatedAt: new Date() },
      });
  }

  return buildCatalogEntry(id, snapshot);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = getDb();

  const [entryRow] = await db
    .select({ catalogId: catalogEntriesTable.catalogId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, id))
    .limit(1);

  if (!entryRow) {
    throw new ServiceError("NOT_FOUND", `Entry "${id}" not found`);
  }

  const [catalogRow] = await db
    .select({ status: catalogsTable.status })
    .from(catalogsTable)
    .where(eq(catalogsTable.id, entryRow.catalogId))
    .limit(1);

  if (catalogRow?.status === "discontinued") {
    throw new ServiceError(
      "CATALOG_LOCKED",
      "This catalog is discontinued. Entries cannot be deleted.",
    );
  }

  await db.delete(catalogEntriesTable).where(eq(catalogEntriesTable.id, id));
}

export async function listEntries(
  catalogId: string,
  templateId: string,
  page = 1,
  limit = 24,
  filters: EntryFilter[] = [],
): Promise<PaginatedEntries> {
  const db = getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  // Fetch all entry IDs for this catalog + template (in display order)
  const allIdRows = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.catalogId, catalogId),
        eq(catalogEntriesTable.templateId, templateId),
      ),
    )
    .orderBy(desc(catalogEntriesTable.updatedAt));

  let entryIds = allIdRows.map((r) => r.id);

  // Apply filters sequentially — AND logic
  for (const filter of filters) {
    entryIds = await applyEntryFilter(entryIds, filter, db);
    if (entryIds.length === 0) break;
  }

  const total = entryIds.length;
  const offset = (safePage - 1) * safeLimit;
  const pageIds = entryIds.slice(offset, offset + safeLimit);

  if (pageIds.length === 0) {
    return { entries: [], total, page: safePage, limit: safeLimit };
  }

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
    .where(inArray(catalogEntriesTable.id, pageIds));

  // Restore the original order (inArray loses ordering)
  const rowMap = new Map(rows.map((r) => [r.id, r]));
  const orderedRows = pageIds.map((id) => rowMap.get(id)).filter(Boolean) as typeof rows;

  return {
    entries: orderedRows.map((r) => ({
      id: r.id,
      catalogId: r.catalogId,
      templateId: r.templateId,
      displayName: r.displayName ?? `Untitled #${r.id.substring(0, 8)}`,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    total,
    page: safePage,
    limit: safeLimit,
  };
}

// ---------------------------------------------------------------------------
// O-03 — Relationship Instance Linking
// ---------------------------------------------------------------------------

function findRelationshipInSnapshot(
  snapshot: SchemaSnapshot,
  relationshipId: string,
): SnapshotRelationship | null {
  for (const t of snapshot.templates) {
    const rel = t.relationships.find((r) => r.id === relationshipId);
    if (rel) return rel;
  }
  return null;
}

export async function getLinkedEntries(entryId: string): Promise<EntryLinkInstance[]> {
  const db = getDb();

  const [entryRow] = await db
    .select({ catalogId: catalogEntriesTable.catalogId, templateId: catalogEntriesTable.templateId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, entryId))
    .limit(1);

  if (!entryRow) {
    throw new ServiceError("NOT_FOUND", `Entry "${entryId}" not found`);
  }

  const snapshot = await getPublishedSchemaOrThrow(entryRow.catalogId);

  const linkRows = await db
    .select()
    .from(catalogEntryRelationshipsTable)
    .where(
      or(
        eq(catalogEntryRelationshipsTable.fromEntryId, entryId),
        eq(catalogEntryRelationshipsTable.toEntryId, entryId),
      ),
    );

  const allEntryIds = new Set<string>();
  for (const row of linkRows) {
    allEntryIds.add(row.fromEntryId);
    allEntryIds.add(row.toEntryId);
  }

  let entryNameMap = new Map<string, { displayName: string; templateId: string }>();
  if (allEntryIds.size > 0) {
    const entryIds = Array.from(allEntryIds);
    const entryRows = await db
      .select({
        id: catalogEntriesTable.id,
        displayName: catalogEntriesTable.displayName,
        templateId: catalogEntriesTable.templateId,
      })
      .from(catalogEntriesTable)
      .where(sql`${catalogEntriesTable.id} IN (${sql.join(entryIds.map((id) => sql`${id}::uuid`), sql`, `)})`);
    entryNameMap = new Map(
      entryRows.map((r) => [r.id, { displayName: r.displayName ?? `Untitled #${r.id.substring(0, 8)}`, templateId: r.templateId }]),
    );
  }

  const results: EntryLinkInstance[] = [];
  for (const row of linkRows) {
    const relDef = findRelationshipInSnapshot(snapshot, row.relationshipId);
    if (!relDef) continue;

    const isFrom = row.fromEntryId === entryId;
    const otherEntryId = isFrom ? row.toEntryId : row.fromEntryId;
    const otherEntry = entryNameMap.get(otherEntryId);
    const fromEntry = entryNameMap.get(row.fromEntryId);

    const toTemplate = snapshot.templates.find((t) => t.id === relDef.toTemplateId);

    results.push({
      id: row.id,
      relationshipId: row.relationshipId,
      relationshipLabel: relDef.label,
      cardinality: relDef.cardinality,
      direction: isFrom ? "from" : "to",
      fromEntryId: row.fromEntryId,
      fromEntryName: fromEntry?.displayName ?? `Untitled #${row.fromEntryId.substring(0, 8)}`,
      fromTemplateId: relDef.fromTemplateId,
      toEntryId: row.toEntryId,
      toEntryName: entryNameMap.get(row.toEntryId)?.displayName ?? `Untitled #${row.toEntryId.substring(0, 8)}`,
      toTemplateId: relDef.toTemplateId,
      toTemplateName: toTemplate?.name ?? "",
      createdAt: row.createdAt.toISOString(),
    });
  }

  return results;
}

export async function linkEntries(input: LinkEntriesInput): Promise<EntryLinkInstance> {
  const db = getDb();

  const [fromRow] = await db
    .select({ catalogId: catalogEntriesTable.catalogId, templateId: catalogEntriesTable.templateId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, input.fromEntryId))
    .limit(1);

  if (!fromRow) {
    throw new ServiceError("NOT_FOUND", `Source entry "${input.fromEntryId}" not found`);
  }

  const [toRow] = await db
    .select({ catalogId: catalogEntriesTable.catalogId, templateId: catalogEntriesTable.templateId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, input.toEntryId))
    .limit(1);

  if (!toRow) {
    throw new ServiceError("NOT_FOUND", `Target entry "${input.toEntryId}" not found`);
  }

  const snapshot = await getPublishedSchemaOrThrow(fromRow.catalogId);
  const relDef = findRelationshipInSnapshot(snapshot, input.relationshipId);

  if (!relDef) {
    throw new ServiceError("NOT_FOUND", `Relationship definition "${input.relationshipId}" not found in published schema`);
  }

  if (fromRow.templateId !== relDef.fromTemplateId) {
    throw new ServiceError("VALIDATION_ERROR", `Source entry template does not match relationship fromTemplateId`);
  }

  if (toRow.templateId !== relDef.toTemplateId) {
    throw new ServiceError("VALIDATION_ERROR", `Target entry template does not match relationship toTemplateId`);
  }

  if (relDef.cardinality === "1:1") {
    const existingFrom = await db
      .select({ id: catalogEntryRelationshipsTable.id })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.fromEntryId, input.fromEntryId),
          eq(catalogEntryRelationshipsTable.relationshipId, input.relationshipId),
        ),
      )
      .limit(1);
    if (existingFrom.length > 0) {
      throw new ServiceError("CONFLICT", `This relationship only allows one link. Remove the existing link first.`);
    }
    const existingTo = await db
      .select({ id: catalogEntryRelationshipsTable.id })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.toEntryId, input.toEntryId),
          eq(catalogEntryRelationshipsTable.relationshipId, input.relationshipId),
        ),
      )
      .limit(1);
    if (existingTo.length > 0) {
      throw new ServiceError("CONFLICT", `This relationship only allows one link. Remove the existing link first.`);
    }
  } else if (relDef.cardinality === "1:N") {
    const existingTo = await db
      .select({ id: catalogEntryRelationshipsTable.id })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.toEntryId, input.toEntryId),
          eq(catalogEntryRelationshipsTable.relationshipId, input.relationshipId),
        ),
      )
      .limit(1);
    if (existingTo.length > 0) {
      throw new ServiceError(
        "CONFLICT",
        `This entry is already linked from another ${relDef.label}. Remove that link first.`,
      );
    }
  } else {
    // M:N — check for exact duplicate link
    const existingLink = await db
      .select({ id: catalogEntryRelationshipsTable.id })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.fromEntryId, input.fromEntryId),
          eq(catalogEntryRelationshipsTable.toEntryId, input.toEntryId),
          eq(catalogEntryRelationshipsTable.relationshipId, input.relationshipId),
        ),
      )
      .limit(1);
    if (existingLink.length > 0) {
      throw new ServiceError("CONFLICT", `These entries are already linked via ${relDef.label}.`);
    }
  }

  const [inserted] = await db
    .insert(catalogEntryRelationshipsTable)
    .values({
      fromEntryId: input.fromEntryId,
      toEntryId: input.toEntryId,
      relationshipId: input.relationshipId,
    })
    .returning();

  if (!inserted) {
    throw new ServiceError("CONFLICT", `These entries are already linked via ${relDef.label}.`);
  }

  const fromEntry = await db
    .select({ displayName: catalogEntriesTable.displayName })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, input.fromEntryId))
    .limit(1);
  const toEntry = await db
    .select({ displayName: catalogEntriesTable.displayName, templateId: catalogEntriesTable.templateId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, input.toEntryId))
    .limit(1);

  const toTemplate = snapshot.templates.find((t) => t.id === relDef.toTemplateId);

  return {
    id: inserted.id,
    relationshipId: inserted.relationshipId,
    relationshipLabel: relDef.label,
    cardinality: relDef.cardinality,
    direction: "from",
    fromEntryId: inserted.fromEntryId,
    fromEntryName: fromEntry[0]?.displayName ?? `Untitled #${input.fromEntryId.substring(0, 8)}`,
    fromTemplateId: relDef.fromTemplateId,
    toEntryId: inserted.toEntryId,
    toEntryName: toEntry[0]?.displayName ?? `Untitled #${input.toEntryId.substring(0, 8)}`,
    toTemplateId: relDef.toTemplateId,
    toTemplateName: toTemplate?.name ?? "",
    createdAt: inserted.createdAt.toISOString(),
  };
}

export async function unlinkEntries(linkId: string): Promise<void> {
  const db = getDb();

  const [linkRow] = await db
    .select()
    .from(catalogEntryRelationshipsTable)
    .where(eq(catalogEntryRelationshipsTable.id, linkId))
    .limit(1);

  if (!linkRow) {
    throw new ServiceError("NOT_FOUND", `Link "${linkId}" not found`);
  }

  const [fromEntry] = await db
    .select({ catalogId: catalogEntriesTable.catalogId })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, linkRow.fromEntryId))
    .limit(1);

  if (fromEntry) {
    const [catalogRow] = await db
      .select({ status: catalogsTable.status })
      .from(catalogsTable)
      .where(eq(catalogsTable.id, fromEntry.catalogId))
      .limit(1);

    if (catalogRow?.status === "discontinued") {
      throw new ServiceError("CATALOG_LOCKED", "This catalog is discontinued. Links cannot be removed.");
    }
  }

  await db
    .delete(catalogEntryRelationshipsTable)
    .where(eq(catalogEntryRelationshipsTable.id, linkId));
}

// ---------------------------------------------------------------------------
// O-05 — Bulk link
// ---------------------------------------------------------------------------

export async function bulkLinkEntries(input: BulkLinkInput): Promise<BulkLinkResult> {
  if (input.fromEntryIds.length === 0) {
    throw new ServiceError("VALIDATION_ERROR", "fromEntryIds must not be empty");
  }

  const db = getDb();

  const result: BulkLinkResult = {
    attempted: input.fromEntryIds.length,
    succeeded: [],
    skipped: [],
    failed: [],
  };

  for (const fromEntryId of input.fromEntryIds) {
    // Fetch display name first (best effort — use placeholder if not found)
    const [entryRow] = await db
      .select({ displayName: catalogEntriesTable.displayName })
      .from(catalogEntriesTable)
      .where(eq(catalogEntriesTable.id, fromEntryId))
      .limit(1);

    const displayName = entryRow?.displayName ?? `Untitled #${fromEntryId.substring(0, 8)}`;

    try {
      await linkEntries({
        fromEntryId,
        toEntryId: input.toEntryId,
        relationshipId: input.relationshipId,
      });
      result.succeeded.push({ entryId: fromEntryId, displayName });
    } catch (err) {
      const isCardinality = err instanceof ServiceError && err.code === "CONFLICT";
      if (isCardinality) {
        result.skipped.push({
          entryId: fromEntryId,
          displayName,
          reason: err instanceof Error ? err.message : "Cardinality violation",
        });
      } else {
        result.failed.push({
          entryId: fromEntryId,
          displayName,
          reason: err instanceof Error ? err.message : "Unexpected error",
        });
      }
    }
  }

  return result;
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
    .orderBy(desc(catalogEntriesTable.updatedAt))
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
