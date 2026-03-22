import { eq, asc, count, sql, and } from "drizzle-orm";
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
  type SnapshotTemplate,
  type SnapshotSection,
  type SnapshotAttribute,
} from "@workspace/db";
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
  versionNumber: number;
  snapshot: SchemaSnapshot;
  publishedBy: string | null;
  publishedAt: Date;
  isCurrent: boolean;
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

async function getCatalogIdForTemplate(templateId: string): Promise<string> {
  const db = getDb();
  const [row] = await db
    .select({ catalogId: schemaTemplatesTable.catalogId })
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.id, templateId))
    .limit(1);

  if (!row) throw new ServiceError("NOT_FOUND", `Template "${templateId}" not found`);
  return row.catalogId;
}

async function getCatalogIdForSection(sectionId: string): Promise<string> {
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

async function getCatalogIdForAttribute(attributeId: string): Promise<string> {
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

  const [row] = await db
    .insert(schemaSectionsTable)
    .values({
      templateId,
      name: input.name,
      description: input.description ?? null,
      displayOrder: input.displayOrder ?? 0,
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
    throw new ServiceError(
      "SECTION_IN_USE",
      `Section "${section.name}" has attributes and cannot be deleted. Remove all attributes first.`,
    );
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

  const [row] = await db
    .insert(schemaAttributesTable)
    .values({
      sectionId,
      name: input.name,
      slug: toSlug(input.name),
      description: input.description ?? null,
      attributeType: input.attributeType,
      required: input.required ?? false,
      displayOrder: input.displayOrder ?? 0,
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
      "CONFLICT",
      `Attribute "${attr.name}" has catalog entry values and cannot be deleted. Remove entry values first.`,
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
// Schema versioning
// ---------------------------------------------------------------------------

export async function publishSchema(catalogId: string): Promise<SchemaVersion> {
  const db = getDb();
  await assertCatalogNotLocked(catalogId);

  return await db.transaction(async (tx) => {
    const [latestVersion] = await tx
      .select({ versionNumber: schemaVersionsTable.versionNumber })
      .from(schemaVersionsTable)
      .orderBy(sql`${schemaVersionsTable.versionNumber} DESC`)
      .limit(1);

    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    // Fetch catalog
    const [catalog] = await tx
      .select({ name: catalogsTable.name })
      .from(catalogsTable)
      .where(eq(catalogsTable.id, catalogId))
      .limit(1);

    if (!catalog) throw new ServiceError("NOT_FOUND", `Catalog "${catalogId}" not found`);

    const templates = await tx
      .select()
      .from(schemaTemplatesTable)
      .where(eq(schemaTemplatesTable.catalogId, catalogId))
      .orderBy(asc(schemaTemplatesTable.name));

    const sections = await tx
      .select()
      .from(schemaSectionsTable)
      .orderBy(asc(schemaSectionsTable.displayOrder));

    const attributes = await tx
      .select()
      .from(schemaAttributesTable)
      .orderBy(asc(schemaAttributesTable.displayOrder));

    const relationships = await tx.select().from(schemaRelationshipsTable);

    const sectionMap = new Map<string, SnapshotSection>();
    for (const s of sections) {
      sectionMap.set(s.id, {
        id: s.id,
        name: s.name,
        description: s.description,
        displayOrder: s.displayOrder,
        attributes: [],
      });
    }

    for (const a of attributes) {
      const sec = sectionMap.get(a.sectionId);
      if (sec) {
        sec.attributes.push({
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
    }

    const templateIds = new Set(templates.map((t) => t.id));

    const snapshotTemplates: SnapshotTemplate[] = templates.map((t) => {
      const templateSections = sections
        .filter((s) => s.templateId === t.id)
        .map((s) => sectionMap.get(s.id)!)
        .filter(Boolean);

      const templateRelationships = relationships
        .filter((r) => templateIds.has(r.fromTemplateId) || templateIds.has(r.toTemplateId))
        .filter((r) => r.fromTemplateId === t.id || r.toTemplateId === t.id)
        .map((r) => ({
          id: r.id,
          fromTemplateId: r.fromTemplateId,
          toTemplateId: r.toTemplateId,
          label: r.label,
          cardinality: r.cardinality as "1:1" | "1:N" | "M:N",
          direction: r.direction as "from" | "to" | "both",
        }));

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        description: t.description,
        isSystemSeed: t.isSystemSeed,
        isReferenceData: t.isReferenceData,
        sections: templateSections,
        relationships: templateRelationships,
      };
    });

    const snapshot: SchemaSnapshot = {
      version: nextVersion,
      publishedAt: new Date().toISOString(),
      catalogId,
      catalogName: catalog.name,
      templates: snapshotTemplates,
    };

    await tx
      .update(schemaVersionsTable)
      .set({ isCurrent: false })
      .where(eq(schemaVersionsTable.isCurrent, true));

    const [version] = await tx
      .insert(schemaVersionsTable)
      .values({
        versionNumber: nextVersion,
        snapshot: snapshot as unknown as Record<string, unknown>,
        isCurrent: true,
      })
      .returning();

    return {
      id: version.id,
      versionNumber: version.versionNumber,
      snapshot,
      publishedBy: version.publishedBy,
      publishedAt: version.publishedAt,
      isCurrent: version.isCurrent,
    };
  });
}

export async function getCurrentPublishedSchema(): Promise<SchemaVersion | null> {
  const db = getDb();
  const [version] = await db
    .select()
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.isCurrent, true))
    .limit(1);

  if (!version) return null;

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    snapshot: version.snapshot as unknown as SchemaSnapshot,
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt,
    isCurrent: version.isCurrent,
  };
}
