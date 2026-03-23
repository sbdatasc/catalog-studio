import { eq, asc, count, sql, and, max, inArray, desc } from "drizzle-orm";
import {
  catalogsTable,
  schemaTemplatesTable,
  schemaSectionsTable,
  schemaAttributesTable,
  schemaRelationshipsTable,
  schemaVersionsTable,
  catalogEntriesTable,
  catalogFieldValuesTable,
  AttributeConfigSchema,
  type AttributeType,
  type AttributeConfig,
  type SchemaSnapshot,
  type SchemaDiff,
  type SnapshotTemplate,
  type SnapshotSection,
  type SnapshotAttribute,
} from "@workspace/db";
import { computeDiff } from "../utils/computeDiff";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { toSlug } from "../lib/utils";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface CatalogTemplate {
  id: string;
  catalogId: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  isReferenceData: boolean;
  sectionCount: number;
  attributeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Section {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  attributeCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttributeDefinition {
  id: string;
  sectionId: string;
  name: string;
  slug: string;
  description: string | null;
  attributeType: AttributeType;
  required: boolean;
  displayOrder: number;
  config: AttributeConfig;
  createdAt: Date;
}

export interface Relationship {
  id: string;
  fromTemplateId: string;
  toTemplateId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
  createdAt: Date;
}

export interface SchemaVersion {
  id: string;
  catalogId: string;
  versionNumber: number;
  snapshot: SchemaSnapshot;
  diff: SchemaDiff | null;
  entryCount: number;
  publishedBy: string | null;
  publishedAt: Date;
  isCurrent: boolean;
}

export type ChecklistCheckId =
  | "has_templates"
  | "no_empty_templates"
  | "no_empty_sections"
  | "no_broken_references"
  | "no_broken_relationships"
  | "reference_data_valid";

export interface ChecklistCheck {
  id: ChecklistCheckId;
  passing: boolean;
  message: string;
  detail?: string;
  navRoute?: string;
}

export interface ChecklistResult {
  allPassing: boolean;
  checks: ChecklistCheck[];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateTemplateInput {
  name: string;
  description?: string | null;
  isReferenceData?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
}

export interface CreateSectionInput {
  name: string;
  description?: string | null;
  displayOrder?: number;
}

export interface UpdateSectionInput {
  name?: string;
  description?: string | null;
  displayOrder?: number;
}

export interface CreateAttributeInput {
  name: string;
  attributeType: AttributeType;
  description?: string | null;
  required?: boolean;
  displayOrder?: number;
  config?: AttributeConfig;
}

export interface UpdateAttributeInput {
  name?: string;
  description?: string | null;
  required?: boolean;
  displayOrder?: number;
  config?: AttributeConfig;
}

export interface CreateRelationshipInput {
  fromTemplateId: string;
  toTemplateId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction?: "from" | "to" | "both";
}

// ---------------------------------------------------------------------------
// Catalog-lock helpers
// ---------------------------------------------------------------------------

async function assertCatalogNotLocked(catalogId: string): Promise<void> {
  const db = getDb();
  const [catalog] = await db
    .select({ status: catalogsTable.status })
    .from(catalogsTable)
    .where(eq(catalogsTable.id, catalogId))
    .limit(1);

  if (!catalog) {
    throw new ServiceError("NOT_FOUND", `Catalog "${catalogId}" not found`);
  }
  if (catalog.status !== "draft") {
    throw new ServiceError(
      "CATALOG_LOCKED",
      "This catalog is locked for editing. Duplicate it to make changes.",
    );
  }
}

export async function getCatalogIdForTemplate(templateId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaTemplatesTable.catalogId })
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.id, templateId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Template "${templateId}" not found`);
  return row.catalogId;
}

export async function getCatalogIdForSection(sectionId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaTemplatesTable.catalogId })
    .from(schemaSectionsTable)
    .innerJoin(schemaTemplatesTable, eq(schemaSectionsTable.templateId, schemaTemplatesTable.id))
    .where(eq(schemaSectionsTable.id, sectionId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Section "${sectionId}" not found`);
  return row.catalogId;
}

export async function getCatalogIdForAttribute(attributeId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaTemplatesTable.catalogId })
    .from(schemaAttributesTable)
    .innerJoin(schemaSectionsTable, eq(schemaAttributesTable.sectionId, schemaSectionsTable.id))
    .innerJoin(schemaTemplatesTable, eq(schemaSectionsTable.templateId, schemaTemplatesTable.id))
    .where(eq(schemaAttributesTable.id, attributeId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Attribute "${attributeId}" not found`);
  return row.catalogId;
}

export async function getCatalogIdForSchemaVersion(versionId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaVersionsTable.catalogId })
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.id, versionId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Schema version "${versionId}" not found`);
  return row.catalogId;
}

export async function getCatalogIdForTemplateRelationship(relationshipId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaTemplatesTable.catalogId })
    .from(schemaRelationshipsTable)
    .innerJoin(schemaTemplatesTable, eq(schemaRelationshipsTable.fromTemplateId, schemaTemplatesTable.id))
    .where(eq(schemaRelationshipsTable.id, relationshipId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Relationship "${relationshipId}" not found`);
  return row.catalogId;
}

// ---------------------------------------------------------------------------
// Attribute validation helpers
// ---------------------------------------------------------------------------

function assertValidAttributeType(attributeType: string): asserts attributeType is AttributeType {
  const valid = ["string", "text", "number", "boolean", "date", "enum", "reference", "reference_data"];
  if (!valid.includes(attributeType)) {
    throw new ServiceError("VALIDATION_ERROR", `Invalid attribute type: "${attributeType}"`);
  }
}

function validateAttributeConfig(
  attributeType: AttributeType,
  config: AttributeConfig | undefined,
): AttributeConfig {
  const result = AttributeConfigSchema.safeParse({ attributeType, config: config ?? null });
  if (!result.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Invalid config for attribute type "${attributeType}": ${result.error.message}`,
    );
  }
  return result.data.config as AttributeConfig;
}

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export async function listTemplates(
  catalogId: string,
  isReferenceData?: boolean,
): Promise<CatalogTemplate[]> {
  const db = getDb();

  const sectionCounts = await db
    .select({
      templateId: schemaSectionsTable.templateId,
      sectionCount: count(schemaSectionsTable.id),
    })
    .from(schemaSectionsTable)
    .groupBy(schemaSectionsTable.templateId);

  const sectionCountMap = new Map(sectionCounts.map((r) => [r.templateId, Number(r.sectionCount)]));

  const attrCounts = await db
    .select({
      templateId: schemaSectionsTable.templateId,
      attributeCount: count(schemaAttributesTable.id),
    })
    .from(schemaAttributesTable)
    .innerJoin(schemaSectionsTable, eq(schemaAttributesTable.sectionId, schemaSectionsTable.id))
    .groupBy(schemaSectionsTable.templateId);

  const attrCountMap = new Map(attrCounts.map((r) => [r.templateId, Number(r.attributeCount)]));

  const conditions = [eq(schemaTemplatesTable.catalogId, catalogId)];
  if (isReferenceData !== undefined) {
    conditions.push(eq(schemaTemplatesTable.isReferenceData, isReferenceData));
  }

  const rows = await db
    .select()
    .from(schemaTemplatesTable)
    .where(and(...conditions))
    .orderBy(asc(schemaTemplatesTable.name));

  return rows.map((r) => ({
    ...r,
    sectionCount: sectionCountMap.get(r.id) ?? 0,
    attributeCount: attrCountMap.get(r.id) ?? 0,
  }));
}

export async function getTemplate(id: string): Promise<CatalogTemplate> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("NOT_FOUND", `Template "${id}" not found`);
  }

  const [sectionCountRow] = await db
    .select({ count: count(schemaSectionsTable.id) })
    .from(schemaSectionsTable)
    .where(eq(schemaSectionsTable.templateId, id));

  const [attrCountRow] = await db
    .select({ count: count(schemaAttributesTable.id) })
    .from(schemaAttributesTable)
    .innerJoin(schemaSectionsTable, eq(schemaAttributesTable.sectionId, schemaSectionsTable.id))
    .where(eq(schemaSectionsTable.templateId, id));

  return {
    ...row,
    sectionCount: Number(sectionCountRow?.count ?? 0),
    attributeCount: Number(attrCountRow?.count ?? 0),
  };
}

export async function createTemplate(
  catalogId: string,
  input: CreateTemplateInput,
): Promise<CatalogTemplate> {
  const db = getDb();
  await assertCatalogNotLocked(catalogId);

  const existing = await db
    .select({ id: schemaTemplatesTable.id })
    .from(schemaTemplatesTable)
    .where(and(eq(schemaTemplatesTable.catalogId, catalogId), eq(schemaTemplatesTable.name, input.name)))
    .limit(1);

  if (existing.length > 0) {
    throw new ServiceError("CONFLICT", `A template named "${input.name}" already exists in this catalog`);
  }

  const slug = toSlug(input.name);
  const [row] = await db
    .insert(schemaTemplatesTable)
    .values({
      catalogId,
      name: input.name,
      slug,
      description: input.description ?? null,
      isSystemSeed: false,
      isReferenceData: input.isReferenceData ?? false,
    })
    .returning();

  return { ...row, sectionCount: 0, attributeCount: 0 };
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<CatalogTemplate> {
  const db = getDb();
  const template = await getTemplate(id);
  await assertCatalogNotLocked(template.catalogId);

  if (input.name && input.name !== template.name) {
    if (template.isSystemSeed) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Template "${template.name}" is a system seed — its name cannot be changed`,
      );
    }
    const conflict = await db
      .select({ id: schemaTemplatesTable.id })
      .from(schemaTemplatesTable)
      .where(and(eq(schemaTemplatesTable.catalogId, template.catalogId), eq(schemaTemplatesTable.name, input.name)))
      .limit(1);
    if (conflict.length > 0) {
      throw new ServiceError("CONFLICT", `A template named "${input.name}" already exists in this catalog`);
    }
  }

  const newName = input.name ?? template.name;
  const newSlug = input.name ? toSlug(input.name) : template.slug;
  const newDescription = input.description !== undefined ? input.description : template.description;

  const [updated] = await db
    .update(schemaTemplatesTable)
    .set({ name: newName, slug: newSlug, description: newDescription, updatedAt: new Date() })
    .where(eq(schemaTemplatesTable.id, id))
    .returning();

  return { ...updated, sectionCount: template.sectionCount, attributeCount: template.attributeCount };
}

export async function deleteTemplate(id: string): Promise<void> {
  const db = getDb();
  const template = await getTemplate(id);
  await assertCatalogNotLocked(template.catalogId);

  if (template.isSystemSeed) {
    throw new ServiceError("VALIDATION_ERROR", `Template "${template.name}" is a system seed and cannot be deleted`);
  }

  const entries = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.templateId, id))
    .limit(1);

  if (entries.length > 0) {
    throw new ServiceError(
      "TEMPLATE_IN_USE",
      `Template "${template.name}" has catalog entries and cannot be deleted. Remove all entries first.`,
    );
  }

  await db.delete(schemaTemplatesTable).where(eq(schemaTemplatesTable.id, id));
}

// ---------------------------------------------------------------------------
// Section CRUD
// ---------------------------------------------------------------------------

export async function listSections(templateId: string): Promise<Section[]> {
  const db = getDb();
  await getTemplate(templateId);

  const attrCounts = await db
    .select({
      sectionId: schemaAttributesTable.sectionId,
      attributeCount: count(schemaAttributesTable.id),
    })
    .from(schemaAttributesTable)
    .groupBy(schemaAttributesTable.sectionId);

  const attrCountMap = new Map(attrCounts.map((r) => [r.sectionId, Number(r.attributeCount)]));

  const rows = await db
    .select()
    .from(schemaSectionsTable)
    .where(eq(schemaSectionsTable.templateId, templateId))
    .orderBy(asc(schemaSectionsTable.displayOrder), asc(schemaSectionsTable.name));

  return rows.map((r) => ({ ...r, attributeCount: attrCountMap.get(r.id) ?? 0 }));
}

export async function getSection(id: string): Promise<Section> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schemaSectionsTable)
    .where(eq(schemaSectionsTable.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("NOT_FOUND", `Section "${id}" not found`);
  }

  const [attrCountRow] = await db
    .select({ count: count(schemaAttributesTable.id) })
    .from(schemaAttributesTable)
    .where(eq(schemaAttributesTable.sectionId, id));

  return { ...row, attributeCount: Number(attrCountRow?.count ?? 0) };
}

export async function createSection(
  templateId: string,
  input: CreateSectionInput,
): Promise<Section> {
  const db = getDb();
  await getTemplate(templateId);
  const catalogId = await getCatalogIdForTemplate(templateId);
  await assertCatalogNotLocked(catalogId);

  const existing = await db
    .select({ id: schemaSectionsTable.id })
    .from(schemaSectionsTable)
    .where(and(eq(schemaSectionsTable.templateId, templateId), eq(schemaSectionsTable.name, input.name)))
    .limit(1);

  if (existing.length > 0) {
    throw new ServiceError("CONFLICT", `A section named "${input.name}" already exists in this template`);
  }

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: max(schemaSectionsTable.displayOrder) })
      .from(schemaSectionsTable)
      .where(eq(schemaSectionsTable.templateId, templateId));
    displayOrder = (maxRow?.maxOrder ?? -1) + 1;
  }

  const [row] = await db
    .insert(schemaSectionsTable)
    .values({
      templateId,
      name: input.name,
      description: input.description ?? null,
      displayOrder,
    })
    .returning();

  return { ...row, attributeCount: 0 };
}

export async function updateSection(
  id: string,
  input: UpdateSectionInput,
): Promise<Section> {
  const db = getDb();
  const section = await getSection(id);
  const catalogId = await getCatalogIdForSection(id);
  await assertCatalogNotLocked(catalogId);

  if (input.name && input.name !== section.name) {
    const conflict = await db
      .select({ id: schemaSectionsTable.id })
      .from(schemaSectionsTable)
      .where(and(eq(schemaSectionsTable.templateId, section.templateId), eq(schemaSectionsTable.name, input.name)))
      .limit(1);

    if (conflict.length > 0) {
      throw new ServiceError("CONFLICT", `A section named "${input.name}" already exists in this template`);
    }
  }

  const [updated] = await db
    .update(schemaSectionsTable)
    .set({
      name: input.name ?? section.name,
      description: input.description !== undefined ? input.description : section.description,
      displayOrder: input.displayOrder ?? section.displayOrder,
      updatedAt: new Date(),
    })
    .where(eq(schemaSectionsTable.id, id))
    .returning();

  return { ...updated, attributeCount: section.attributeCount };
}

export async function deleteSection(id: string): Promise<void> {
  const db = getDb();
  const section = await getSection(id);
  const catalogId = await getCatalogIdForSection(id);
  await assertCatalogNotLocked(catalogId);

  if (section.attributeCount > 0) {
    // Check if any attributes in this section have field values
    const attributeIds = await db
      .select({ id: schemaAttributesTable.id })
      .from(schemaAttributesTable)
      .where(eq(schemaAttributesTable.sectionId, id));

    if (attributeIds.length > 0) {
      const [valueRow] = await db
        .select({ id: catalogFieldValuesTable.id })
        .from(catalogFieldValuesTable)
        .where(
          sql`${catalogFieldValuesTable.attributeId} = ANY(ARRAY[${sql.join(
            attributeIds.map((a) => sql`${a.id}::uuid`),
            sql`, `,
          )}])`,
        )
        .limit(1);

      if (valueRow) {
        throw new ServiceError(
          "SECTION_IN_USE",
          `Section "${section.name}" has data in existing entries and cannot be deleted.`,
        );
      }
    }

    // Cascade-delete all attributes in this section first
    await db.delete(schemaAttributesTable).where(eq(schemaAttributesTable.sectionId, id));
  }

  await db.delete(schemaSectionsTable).where(eq(schemaSectionsTable.id, id));
}

export async function reorderSections(
  templateId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getDb();
  await getTemplate(templateId);
  const catalogId = await getCatalogIdForTemplate(templateId);
  await assertCatalogNotLocked(catalogId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schemaSectionsTable)
        .set({ displayOrder: i, updatedAt: new Date() })
        .where(eq(schemaSectionsTable.id, orderedIds[i]));
    }
  });
}

// ---------------------------------------------------------------------------
// Attribute CRUD
// ---------------------------------------------------------------------------

export async function listAttributes(sectionId: string): Promise<AttributeDefinition[]> {
  const db = getDb();
  await getSection(sectionId);

  const rows = await db
    .select()
    .from(schemaAttributesTable)
    .where(eq(schemaAttributesTable.sectionId, sectionId))
    .orderBy(asc(schemaAttributesTable.displayOrder));

  return rows.map((r) => ({
    ...r,
    attributeType: r.attributeType as AttributeType,
    config: r.config as AttributeConfig,
  }));
}

export async function getAttribute(id: string): Promise<AttributeDefinition> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schemaAttributesTable)
    .where(eq(schemaAttributesTable.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("NOT_FOUND", `Attribute "${id}" not found`);
  }

  return {
    ...row,
    attributeType: row.attributeType as AttributeType,
    config: row.config as AttributeConfig,
  };
}

export async function createAttribute(
  sectionId: string,
  input: CreateAttributeInput,
): Promise<AttributeDefinition> {
  const db = getDb();
  const section = await getSection(sectionId);
  const catalogId = await getCatalogIdForSection(sectionId);
  await assertCatalogNotLocked(catalogId);

  // Look up parent template to check is_reference_data
  const [templateRow] = await db
    .select({ isReferenceData: schemaTemplatesTable.isReferenceData })
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.id, section.templateId))
    .limit(1);

  assertValidAttributeType(input.attributeType);

  // Restrict types on reference data templates
  if (templateRow?.isReferenceData && ["reference", "reference_data"].includes(input.attributeType)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      'Reference and reference_data types are not allowed on Reference Data templates.',
    );
  }

  // Validate reference_data config — targetTemplateId must point to is_reference_data=true template
  if (input.attributeType === "reference_data") {
    const cfg = input.config as { targetTemplateId?: string } | null;
    if (!cfg?.targetTemplateId) {
      throw new ServiceError("VALIDATION_ERROR", `Attribute type "reference_data" requires config.targetTemplateId`);
    }
    const [targetTemplate] = await db
      .select({ id: schemaTemplatesTable.id, isReferenceData: schemaTemplatesTable.isReferenceData })
      .from(schemaTemplatesTable)
      .where(eq(schemaTemplatesTable.id, cfg.targetTemplateId))
      .limit(1);

    if (!targetTemplate) {
      throw new ServiceError("VALIDATION_ERROR", `Template "${cfg.targetTemplateId}" does not exist`);
    }
    if (!targetTemplate.isReferenceData) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Template "${cfg.targetTemplateId}" is not a Reference Data template. config.targetTemplateId must point to a template with is_reference_data=true`,
      );
    }
  }

  const config = validateAttributeConfig(input.attributeType, input.config);

  let displayOrder = input.displayOrder;
  if (displayOrder === undefined) {
    const [maxRow] = await db
      .select({ maxOrder: max(schemaAttributesTable.displayOrder) })
      .from(schemaAttributesTable)
      .where(eq(schemaAttributesTable.sectionId, sectionId));
    displayOrder = (maxRow?.maxOrder ?? -1) + 1;
  }

  const [row] = await db
    .insert(schemaAttributesTable)
    .values({
      sectionId,
      name: input.name,
      slug: toSlug(input.name),
      description: input.description ?? null,
      attributeType: input.attributeType,
      required: input.required ?? false,
      displayOrder,
      config,
    })
    .returning();

  return {
    ...row,
    attributeType: row.attributeType as AttributeType,
    config: row.config as AttributeConfig,
  };
}

export async function updateAttribute(
  id: string,
  input: UpdateAttributeInput & { attributeType?: string },
): Promise<AttributeDefinition> {
  const db = getDb();
  const existing = await getAttribute(id);
  const catalogId = await getCatalogIdForAttribute(id);
  await assertCatalogNotLocked(catalogId);

  if (input.attributeType && input.attributeType !== existing.attributeType) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Cannot change attribute type after creation. Attribute "${existing.name}" is type "${existing.attributeType}"`,
    );
  }

  const config =
    input.config !== undefined
      ? validateAttributeConfig(existing.attributeType, input.config)
      : existing.config;

  const [updated] = await db
    .update(schemaAttributesTable)
    .set({
      name: input.name ?? existing.name,
      slug: input.name ? toSlug(input.name) : existing.slug,
      description: input.description !== undefined ? input.description : existing.description,
      required: input.required ?? existing.required,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      config,
    })
    .where(eq(schemaAttributesTable.id, id))
    .returning();

  return {
    ...updated,
    attributeType: updated.attributeType as AttributeType,
    config: updated.config as AttributeConfig,
  };
}

export async function deleteAttribute(id: string): Promise<void> {
  const db = getDb();
  const attr = await getAttribute(id);
  const catalogId = await getCatalogIdForAttribute(id);
  await assertCatalogNotLocked(catalogId);

  const [valueRow] = await db
    .select({ id: catalogFieldValuesTable.id })
    .from(catalogFieldValuesTable)
    .where(eq(catalogFieldValuesTable.attributeId, id))
    .limit(1);

  if (valueRow) {
    throw new ServiceError(
      "SECTION_IN_USE",
      `Attribute "${attr.name}" has data in existing entries and cannot be deleted.`,
    );
  }

  await db.delete(schemaAttributesTable).where(eq(schemaAttributesTable.id, id));
}

export async function reorderAttributes(
  sectionId: string,
  orderedIds: string[],
): Promise<void> {
  const db = getDb();
  await getSection(sectionId);
  const catalogId = await getCatalogIdForSection(sectionId);
  await assertCatalogNotLocked(catalogId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schemaAttributesTable)
        .set({ displayOrder: i })
        .where(eq(schemaAttributesTable.id, orderedIds[i]));
    }
  });
}

// ---------------------------------------------------------------------------
// Relationship CRUD
// ---------------------------------------------------------------------------

export async function listRelationships(templateId?: string): Promise<Relationship[]> {
  const db = getDb();

  const rows = await (templateId
    ? db
        .select()
        .from(schemaRelationshipsTable)
        .where(
          sql`${schemaRelationshipsTable.fromTemplateId} = ${templateId}
            OR ${schemaRelationshipsTable.toTemplateId} = ${templateId}`,
        )
    : db.select().from(schemaRelationshipsTable));

  return rows.map((r) => ({
    ...r,
    cardinality: r.cardinality as "1:1" | "1:N" | "M:N",
    direction: r.direction as "from" | "to" | "both",
  }));
}

export async function createRelationship(input: CreateRelationshipInput): Promise<Relationship> {
  const db = getDb();
  await getTemplate(input.fromTemplateId);
  await getTemplate(input.toTemplateId);

  const validCardinalities = ["1:1", "1:N", "M:N"];
  if (!validCardinalities.includes(input.cardinality)) {
    throw new ServiceError("VALIDATION_ERROR", `Invalid cardinality "${input.cardinality}". Must be one of: 1:1, 1:N, M:N`);
  }

  const [row] = await db
    .insert(schemaRelationshipsTable)
    .values({
      fromTemplateId: input.fromTemplateId,
      toTemplateId: input.toTemplateId,
      label: input.label,
      cardinality: input.cardinality,
      direction: input.direction ?? "both",
    })
    .returning();

  return {
    ...row,
    cardinality: row.cardinality as "1:1" | "1:N" | "M:N",
    direction: row.direction as "from" | "to" | "both",
  };
}

export async function deleteRelationship(id: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(schemaRelationshipsTable)
    .where(eq(schemaRelationshipsTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Relationship "${id}" not found`);
  }

  await db.delete(schemaRelationshipsTable).where(eq(schemaRelationshipsTable.id, id));
}

// ---------------------------------------------------------------------------
// Publish checklist
// ---------------------------------------------------------------------------

export async function getPublishChecklist(catalogId: string): Promise<ChecklistResult> {
  const db = getDb();

  const templates = await db
    .select()
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.catalogId, catalogId))
    .orderBy(asc(schemaTemplatesTable.name));

  const standardTemplates = templates.filter((t) => !t.isReferenceData);
  const refDataTemplates = templates.filter((t) => t.isReferenceData);
  const allTemplateIds = templates.map((t) => t.id);

  const sections =
    allTemplateIds.length > 0
      ? await db
          .select()
          .from(schemaSectionsTable)
          .where(inArray(schemaSectionsTable.templateId, allTemplateIds))
      : [];

  const sectionIds = sections.map((s) => s.id);
  const attributes =
    sectionIds.length > 0
      ? await db
          .select()
          .from(schemaAttributesTable)
          .where(inArray(schemaAttributesTable.sectionId, sectionIds))
      : [];

  const relationships =
    allTemplateIds.length > 0
      ? await db
          .select()
          .from(schemaRelationshipsTable)
          .where(
            sql`${schemaRelationshipsTable.fromTemplateId} IN (${sql.join(allTemplateIds.map((id) => sql`${id}::uuid`), sql`, `)}) OR ${schemaRelationshipsTable.toTemplateId} IN (${sql.join(allTemplateIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
          )
      : [];

  const templateIdSet = new Set(allTemplateIds);
  const sectionsByTemplate = new Map<string, typeof sections>();
  const attrsBySection = new Map<string, typeof attributes>();

  for (const s of sections) {
    const existing = sectionsByTemplate.get(s.templateId) ?? [];
    existing.push(s);
    sectionsByTemplate.set(s.templateId, existing);
  }
  for (const a of attributes) {
    const existing = attrsBySection.get(a.sectionId) ?? [];
    existing.push(a);
    attrsBySection.set(a.sectionId, existing);
  }

  const checks: ChecklistCheck[] = [];

  // 1. has_templates
  const hasTemplates = standardTemplates.length > 0;
  checks.push({
    id: "has_templates",
    passing: hasTemplates,
    message: hasTemplates
      ? `${standardTemplates.length} template${standardTemplates.length === 1 ? "" : "s"} defined`
      : "Add at least one template before publishing.",
    navRoute: hasTemplates ? undefined : `/catalogs/${catalogId}/designer/templates`,
  });

  // 2. no_empty_templates
  const emptyTemplate = standardTemplates.find((t) => (sectionsByTemplate.get(t.id) ?? []).length === 0);
  const noEmptyTemplates = !emptyTemplate;
  checks.push({
    id: "no_empty_templates",
    passing: noEmptyTemplates,
    message: noEmptyTemplates
      ? "All templates have at least one section"
      : `${emptyTemplate!.name} has no sections. Add at least one section.`,
    detail: emptyTemplate?.name,
    navRoute: emptyTemplate
      ? `/catalogs/${catalogId}/designer/templates/${emptyTemplate.id}`
      : undefined,
  });

  // 3. no_empty_sections
  let emptySection: { name: string; templateId: string; templateName: string } | undefined;
  for (const s of sections) {
    if ((attrsBySection.get(s.id) ?? []).length === 0) {
      const tpl = templates.find((t) => t.id === s.templateId);
      emptySection = { name: s.name, templateId: s.templateId, templateName: tpl?.name ?? "" };
      break;
    }
  }
  const noEmptySections = !emptySection;
  checks.push({
    id: "no_empty_sections",
    passing: noEmptySections,
    message: noEmptySections
      ? "All sections have at least one attribute"
      : `"${emptySection!.name}" in "${emptySection!.templateName}" has no attributes.`,
    detail: emptySection ? `${emptySection.name} in ${emptySection.templateName}` : undefined,
    navRoute: emptySection
      ? `/catalogs/${catalogId}/designer/templates/${emptySection.templateId}`
      : undefined,
  });

  // 4. no_broken_references
  let brokenRefAttr: { name: string; templateId: string } | undefined;
  for (const a of attributes) {
    if (a.attributeType === "reference" || a.attributeType === "reference_data") {
      const cfg = a.config as { targetTemplateId?: string } | null;
      if (cfg?.targetTemplateId && !templateIdSet.has(cfg.targetTemplateId)) {
        const sec = sections.find((s) => s.id === a.sectionId);
        brokenRefAttr = { name: a.name, templateId: sec?.templateId ?? "" };
        break;
      }
    }
  }
  const noBrokenReferences = !brokenRefAttr;
  checks.push({
    id: "no_broken_references",
    passing: noBrokenReferences,
    message: noBrokenReferences
      ? "No broken attribute references"
      : `"${brokenRefAttr!.name}" references a deleted template. Fix or remove it.`,
    detail: brokenRefAttr?.name,
    navRoute: brokenRefAttr
      ? `/catalogs/${catalogId}/designer/templates/${brokenRefAttr.templateId}`
      : undefined,
  });

  // 5. no_broken_relationships
  const brokenRel = relationships.find(
    (r) => !templateIdSet.has(r.fromTemplateId) || !templateIdSet.has(r.toTemplateId),
  );
  const noBrokenRelationships = !brokenRel;
  checks.push({
    id: "no_broken_relationships",
    passing: noBrokenRelationships,
    message: noBrokenRelationships
      ? "No broken relationship references"
      : `Relationship "${brokenRel!.label}" references a deleted template. Fix or remove it.`,
    detail: brokenRel?.label,
    navRoute: noBrokenRelationships
      ? undefined
      : `/catalogs/${catalogId}/designer/relationships`,
  });

  // 6. reference_data_valid
  let invalidRefData: { name: string; id: string } | undefined;
  for (const t of refDataTemplates) {
    const tSections = sectionsByTemplate.get(t.id) ?? [];
    if (tSections.length === 0) {
      invalidRefData = { name: t.name, id: t.id };
      break;
    }
    const hasAttr = tSections.some((s) => (attrsBySection.get(s.id) ?? []).length > 0);
    if (!hasAttr) {
      invalidRefData = { name: t.name, id: t.id };
      break;
    }
  }
  const refDataValid = !invalidRefData;
  checks.push({
    id: "reference_data_valid",
    passing: refDataValid,
    message: refDataValid
      ? "All reference data templates are valid"
      : `Reference data template "${invalidRefData!.name}" has no attributes defined.`,
    detail: invalidRefData?.name,
    navRoute: invalidRefData
      ? `/catalogs/${catalogId}/designer/reference-data/${invalidRefData.id}`
      : undefined,
  });

  return {
    allPassing: checks.every((c) => c.passing),
    checks,
  };
}

// ---------------------------------------------------------------------------
// Schema versioning — publish
// ---------------------------------------------------------------------------

function toSchemaVersion(row: {
  id: string;
  catalogId: string | null;
  versionNumber: number;
  snapshot: unknown;
  diff?: unknown;
  entryCount: number;
  publishedBy: string | null;
  publishedAt: Date;
  isCurrent: boolean;
}): SchemaVersion {
  return {
    id: row.id,
    catalogId: row.catalogId ?? "",
    versionNumber: row.versionNumber,
    snapshot: row.snapshot as SchemaSnapshot,
    diff: (row.diff as SchemaDiff | null) ?? null,
    entryCount: row.entryCount,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt,
    isCurrent: row.isCurrent,
  };
}

export async function publishSchema(catalogId: string): Promise<SchemaVersion> {
  const db = getDb();

  // Step 0: verify catalog exists and is not locked
  const [catalog] = await db
    .select()
    .from(catalogsTable)
    .where(eq(catalogsTable.id, catalogId))
    .limit(1);

  if (!catalog) throw new ServiceError("NOT_FOUND", `Catalog "${catalogId}" not found`);
  if (catalog.status !== "draft") {
    throw new ServiceError("CATALOG_LOCKED", "Schema publishing is only available for Draft catalogs.");
  }

  // Step 2: run checklist
  const checklist = await getPublishChecklist(catalogId);
  if (!checklist.allPassing) {
    const failing = checklist.checks.find((c) => !c.passing);
    throw new ServiceError("SCHEMA_INVALID", failing?.message ?? "Schema has errors. Fix all checklist items before publishing.");
  }

  return await db.transaction(async (tx) => {
    // Step 1: load all schema data inside the transaction
    const templates = await tx
      .select()
      .from(schemaTemplatesTable)
      .where(eq(schemaTemplatesTable.catalogId, catalogId))
      .orderBy(asc(schemaTemplatesTable.name));

    const templateIds = templates.map((t) => t.id);

    const sections =
      templateIds.length > 0
        ? await tx
            .select()
            .from(schemaSectionsTable)
            .where(inArray(schemaSectionsTable.templateId, templateIds))
            .orderBy(asc(schemaSectionsTable.displayOrder))
        : [];

    const sectionIds = sections.map((s) => s.id);
    const attributes =
      sectionIds.length > 0
        ? await tx
            .select()
            .from(schemaAttributesTable)
            .where(inArray(schemaAttributesTable.sectionId, sectionIds))
            .orderBy(asc(schemaAttributesTable.displayOrder))
        : [];

    const relationships =
      templateIds.length > 0
        ? await tx
            .select()
            .from(schemaRelationshipsTable)
            .where(
              sql`${schemaRelationshipsTable.fromTemplateId} IN (${sql.join(templateIds.map((id) => sql`${id}::uuid`), sql`, `)}) OR ${schemaRelationshipsTable.toTemplateId} IN (${sql.join(templateIds.map((id) => sql`${id}::uuid`), sql`, `)})`,
            )
        : [];

    // Step 3: Build SchemaSnapshot
    const sectionMap = new Map<string, SnapshotSection>();
    for (const s of sections) {
      sectionMap.set(s.id, { id: s.id, name: s.name, description: s.description, displayOrder: s.displayOrder, attributes: [] });
    }
    for (const a of attributes) {
      sectionMap.get(a.sectionId)?.attributes.push({
        id: a.id,
        name: a.name,
        slug: a.slug,
        description: a.description,
        attributeType: a.attributeType as AttributeType,
        required: a.required,
        displayOrder: a.displayOrder,
        config: a.config as AttributeConfig,
      } satisfies SnapshotAttribute);
    }

    const templateIdSet = new Set(templateIds);
    const snapshotTemplates: SnapshotTemplate[] = templates.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description,
      isSystemSeed: t.isSystemSeed,
      isReferenceData: t.isReferenceData,
      sections: sections.filter((s) => s.templateId === t.id).map((s) => sectionMap.get(s.id)!).filter(Boolean),
      relationships: relationships
        .filter((r) => templateIdSet.has(r.fromTemplateId) && templateIdSet.has(r.toTemplateId))
        .filter((r) => r.fromTemplateId === t.id || r.toTemplateId === t.id)
        .map((r) => ({
          id: r.id,
          fromTemplateId: r.fromTemplateId,
          toTemplateId: r.toTemplateId,
          label: r.label,
          cardinality: r.cardinality as "1:1" | "1:N" | "M:N",
          direction: r.direction as "from" | "to" | "both",
        })),
    }));

    // Step 5: increment version
    const [latestVersion] = await tx
      .select({ versionNumber: schemaVersionsTable.versionNumber })
      .from(schemaVersionsTable)
      .where(eq(schemaVersionsTable.catalogId, catalogId))
      .orderBy(desc(schemaVersionsTable.versionNumber))
      .limit(1);

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const snapshot: SchemaSnapshot = {
      version: nextVersionNumber,
      publishedAt: new Date().toISOString(),
      catalogId,
      catalogName: catalog.name,
      templates: snapshotTemplates,
    };

    // Step 4: compute diff against previous snapshot
    const [prevVersion] = await tx
      .select({ snapshot: schemaVersionsTable.snapshot })
      .from(schemaVersionsTable)
      .where(and(eq(schemaVersionsTable.catalogId, catalogId), eq(schemaVersionsTable.isCurrent, true)))
      .limit(1);

    const prevSnapshot = prevVersion ? (prevVersion.snapshot as SchemaSnapshot) : null;
    const diff = computeDiff(prevSnapshot, snapshot);

    // Count existing entries for this catalog
    const [entryCountRow] = await tx
      .select({ count: count(catalogEntriesTable.id) })
      .from(catalogEntriesTable)
      .where(eq(catalogEntriesTable.catalogId, catalogId));
    const entryCount = Number(entryCountRow?.count ?? 0);

    // Step 7: mark previous version as not current
    await tx
      .update(schemaVersionsTable)
      .set({ isCurrent: false })
      .where(and(eq(schemaVersionsTable.catalogId, catalogId), eq(schemaVersionsTable.isCurrent, true)));

    // Step 6: insert new version
    const [newVersion] = await tx
      .insert(schemaVersionsTable)
      .values({
        catalogId,
        versionNumber: nextVersionNumber,
        snapshot: snapshot as unknown as Record<string, unknown>,
        diff: diff as unknown as Record<string, unknown>,
        entryCount,
        isCurrent: true,
      })
      .returning();

    // Step 8: entry migration
    // Find added attributes (in new snapshot, not in old)
    const oldAttrIds = new Set(
      (prevSnapshot?.templates ?? []).flatMap((t) => t.sections.flatMap((s) => s.attributes.map((a) => a.id))),
    );
    const newAttrIds = new Set(snapshotTemplates.flatMap((t) => t.sections.flatMap((s) => s.attributes.map((a) => a.id))));

    const addedAttrIds = [...newAttrIds].filter((id) => !oldAttrIds.has(id));
    const removedAttrIds = [...oldAttrIds].filter((id) => !newAttrIds.has(id));

    // For added attrs: build a map of attribute -> templateId
    if (addedAttrIds.length > 0) {
      for (const attrId of addedAttrIds) {
        // Find the template this attribute belongs to
        let templateId: string | undefined;
        for (const tpl of snapshotTemplates) {
          const found = tpl.sections.some((s) => s.attributes.some((a) => a.id === attrId));
          if (found) { templateId = tpl.id; break; }
        }
        if (!templateId) continue;

        // Get all existing entries for this template
        const existingEntries = await tx
          .select({ id: catalogEntriesTable.id })
          .from(catalogEntriesTable)
          .where(eq(catalogEntriesTable.templateId, templateId));

        if (existingEntries.length > 0) {
          await tx.insert(catalogFieldValuesTable).values(
            existingEntries.map((e) => ({
              entryId: e.id,
              attributeId: attrId,
              valueText: null,
            })),
          );
        }
      }
    }

    // For removed attrs: delete all field values for those attribute_ids
    if (removedAttrIds.length > 0) {
      await tx
        .delete(catalogFieldValuesTable)
        .where(inArray(catalogFieldValuesTable.attributeId, removedAttrIds));
    }

    return toSchemaVersion(newVersion);
  });
}

export async function getCurrentPublishedSchema(catalogId: string): Promise<SchemaVersion | null> {
  const db = getDb();
  const [version] = await db
    .select()
    .from(schemaVersionsTable)
    .where(and(eq(schemaVersionsTable.catalogId, catalogId), eq(schemaVersionsTable.isCurrent, true)))
    .limit(1);

  if (!version) return null;
  return toSchemaVersion(version);
}

export async function getVersionHistory(catalogId: string): Promise<SchemaVersion[]> {
  const db = getDb();
  const versions = await db
    .select()
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.catalogId, catalogId))
    .orderBy(desc(schemaVersionsTable.versionNumber));

  return versions.map(toSchemaVersion);
}

export async function getVersionDiff(versionId: string): Promise<SchemaDiff | null> {
  const db = getDb();
  const [version] = await db
    .select({ diff: schemaVersionsTable.diff })
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.id, versionId))
    .limit(1);

  if (!version) throw new ServiceError("NOT_FOUND", `Schema version "${versionId}" not found`);
  return (version.diff as SchemaDiff | null) ?? null;
}
