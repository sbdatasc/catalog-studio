import { eq, asc, count, sql } from "drizzle-orm";
import {
  schemaEntityTypesTable,
  schemaFieldsTable,
  schemaRelationshipsTable,
  schemaVersionsTable,
  catalogEntriesTable,
  FieldConfigSchema,
  type FieldType,
  type FieldConfig,
  type SchemaSnapshot,
  type SnapshotEntityType,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { toSlug } from "../lib/utils";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface EntityType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  fieldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface FieldDefinition {
  id: string;
  entityTypeId: string;
  name: string;
  slug: string;
  fieldType: FieldType;
  required: boolean;
  displayOrder: number;
  config: FieldConfig;
  createdAt: Date;
}

export interface Relationship {
  id: string;
  fromEntityTypeId: string;
  toEntityTypeId: string;
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

export interface CreateEntityTypeInput {
  name: string;
  description?: string | null;
}

export interface UpdateEntityTypeInput {
  name?: string;
  description?: string | null;
}

export interface CreateFieldInput {
  name: string;
  fieldType: FieldType;
  required?: boolean;
  displayOrder?: number;
  config?: FieldConfig;
}

export interface UpdateFieldInput {
  name?: string;
  required?: boolean;
  displayOrder?: number;
  config?: FieldConfig;
}

export interface CreateRelationshipInput {
  fromEntityTypeId: string;
  toEntityTypeId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction?: "from" | "to" | "both";
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function assertValidFieldType(fieldType: string): asserts fieldType is FieldType {
  const valid = ["string", "text", "number", "boolean", "date", "enum", "reference"];
  if (!valid.includes(fieldType)) {
    throw new ServiceError("VALIDATION_ERROR", `Invalid field type: "${fieldType}"`);
  }
}

function validateFieldConfig(fieldType: FieldType, config: FieldConfig | undefined): FieldConfig {
  const result = FieldConfigSchema.safeParse({ fieldType, config: config ?? null });
  if (!result.success) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Invalid config for field type "${fieldType}": ${result.error.message}`,
    );
  }
  return result.data.config as FieldConfig;
}

// ---------------------------------------------------------------------------
// Entity Type CRUD
// ---------------------------------------------------------------------------

export async function listEntityTypes(): Promise<EntityType[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: schemaEntityTypesTable.id,
      name: schemaEntityTypesTable.name,
      slug: schemaEntityTypesTable.slug,
      description: schemaEntityTypesTable.description,
      isSystemSeed: schemaEntityTypesTable.isSystemSeed,
      createdAt: schemaEntityTypesTable.createdAt,
      updatedAt: schemaEntityTypesTable.updatedAt,
      fieldCount: count(schemaFieldsTable.id),
    })
    .from(schemaEntityTypesTable)
    .leftJoin(
      schemaFieldsTable,
      eq(schemaFieldsTable.entityTypeId, schemaEntityTypesTable.id),
    )
    .groupBy(schemaEntityTypesTable.id)
    .orderBy(asc(schemaEntityTypesTable.name));

  return rows.map((r) => ({ ...r, fieldCount: Number(r.fieldCount) }));
}

export async function getEntityType(id: string): Promise<EntityType> {
  const db = getDb();
  const rows = await db
    .select({
      id: schemaEntityTypesTable.id,
      name: schemaEntityTypesTable.name,
      slug: schemaEntityTypesTable.slug,
      description: schemaEntityTypesTable.description,
      isSystemSeed: schemaEntityTypesTable.isSystemSeed,
      createdAt: schemaEntityTypesTable.createdAt,
      updatedAt: schemaEntityTypesTable.updatedAt,
      fieldCount: count(schemaFieldsTable.id),
    })
    .from(schemaEntityTypesTable)
    .leftJoin(
      schemaFieldsTable,
      eq(schemaFieldsTable.entityTypeId, schemaEntityTypesTable.id),
    )
    .where(eq(schemaEntityTypesTable.id, id))
    .groupBy(schemaEntityTypesTable.id);

  if (rows.length === 0) {
    throw new ServiceError("NOT_FOUND", `Entity type "${id}" not found`);
  }
  return { ...rows[0], fieldCount: Number(rows[0].fieldCount) };
}

export async function createEntityType(
  input: CreateEntityTypeInput,
): Promise<EntityType> {
  const db = getDb();

  // Check for duplicate name
  const existing = await db
    .select({ id: schemaEntityTypesTable.id })
    .from(schemaEntityTypesTable)
    .where(eq(schemaEntityTypesTable.name, input.name))
    .limit(1);

  if (existing.length > 0) {
    throw new ServiceError(
      "CONFLICT",
      `An entity type named "${input.name}" already exists`,
    );
  }

  const slug = toSlug(input.name);
  const [row] = await db
    .insert(schemaEntityTypesTable)
    .values({
      name: input.name,
      slug,
      description: input.description ?? null,
      isSystemSeed: false,
    })
    .returning();

  return { ...row, fieldCount: 0 };
}

export async function updateEntityType(
  id: string,
  input: UpdateEntityTypeInput,
): Promise<EntityType> {
  const db = getDb();
  const entity = await getEntityType(id);

  // System seeds cannot have their name changed
  if (input.name && input.name !== entity.name) {
    if (entity.isSystemSeed) {
      throw new ServiceError(
        "VALIDATION_ERROR",
        `Entity type "${entity.name}" is a system seed — its name cannot be changed`,
      );
    }
    // Check for name conflict
    const conflict = await db
      .select({ id: schemaEntityTypesTable.id })
      .from(schemaEntityTypesTable)
      .where(eq(schemaEntityTypesTable.name, input.name))
      .limit(1);
    if (conflict.length > 0) {
      throw new ServiceError(
        "CONFLICT",
        `An entity type named "${input.name}" already exists`,
      );
    }
  }

  const newName = input.name ?? entity.name;
  const newSlug = input.name ? toSlug(input.name) : entity.slug;
  const newDescription = input.description !== undefined ? input.description : entity.description;

  const [updated] = await db
    .update(schemaEntityTypesTable)
    .set({
      name: newName,
      slug: newSlug,
      description: newDescription,
      updatedAt: new Date(),
    })
    .where(eq(schemaEntityTypesTable.id, id))
    .returning();

  return { ...updated, fieldCount: entity.fieldCount };
}

export async function deleteEntityType(id: string): Promise<void> {
  const db = getDb();
  const entity = await getEntityType(id);

  if (entity.isSystemSeed) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Entity type "${entity.name}" is a system seed and cannot be deleted`,
    );
  }

  // Check for existing catalog entries
  const entries = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.entityTypeId, id))
    .limit(1);

  if (entries.length > 0) {
    throw new ServiceError(
      "ENTITY_TYPE_IN_USE",
      `Entity type "${entity.name}" has catalog entries and cannot be deleted. Remove all entries first.`,
    );
  }

  await db
    .delete(schemaEntityTypesTable)
    .where(eq(schemaEntityTypesTable.id, id));
}

// ---------------------------------------------------------------------------
// Field CRUD
// ---------------------------------------------------------------------------

export async function listFields(entityTypeId: string): Promise<FieldDefinition[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(schemaFieldsTable)
    .where(eq(schemaFieldsTable.entityTypeId, entityTypeId))
    .orderBy(asc(schemaFieldsTable.displayOrder));

  return rows.map((r) => ({
    ...r,
    fieldType: r.fieldType as FieldType,
    config: r.config as FieldConfig,
  }));
}

export async function createField(
  entityTypeId: string,
  input: CreateFieldInput,
): Promise<FieldDefinition> {
  const db = getDb();

  // Validate entity type exists
  await getEntityType(entityTypeId);

  assertValidFieldType(input.fieldType);
  const config = validateFieldConfig(input.fieldType, input.config);

  const [row] = await db
    .insert(schemaFieldsTable)
    .values({
      entityTypeId,
      name: input.name,
      slug: toSlug(input.name),
      fieldType: input.fieldType,
      required: input.required ?? false,
      displayOrder: input.displayOrder ?? 0,
      config,
    })
    .returning();

  return {
    ...row,
    fieldType: row.fieldType as FieldType,
    config: row.config as FieldConfig,
  };
}

export async function updateField(
  fieldId: string,
  input: UpdateFieldInput & { fieldType?: string },
): Promise<FieldDefinition> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schemaFieldsTable)
    .where(eq(schemaFieldsTable.id, fieldId))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Field "${fieldId}" not found`);
  }

  // fieldType must not change after creation
  if (input.fieldType && input.fieldType !== existing.fieldType) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Cannot change field type after creation. Field "${existing.name}" is type "${existing.fieldType}"`,
    );
  }

  const config =
    input.config !== undefined
      ? validateFieldConfig(existing.fieldType as FieldType, input.config)
      : (existing.config as FieldConfig);

  const [updated] = await db
    .update(schemaFieldsTable)
    .set({
      name: input.name ?? existing.name,
      slug: input.name ? toSlug(input.name) : existing.slug,
      required: input.required ?? existing.required,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      config,
    })
    .where(eq(schemaFieldsTable.id, fieldId))
    .returning();

  return {
    ...updated,
    fieldType: updated.fieldType as FieldType,
    config: updated.config as FieldConfig,
  };
}

export async function deleteField(fieldId: string): Promise<void> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schemaFieldsTable)
    .where(eq(schemaFieldsTable.id, fieldId))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Field "${fieldId}" not found`);
  }

  await db
    .delete(schemaFieldsTable)
    .where(eq(schemaFieldsTable.id, fieldId));
}

// ---------------------------------------------------------------------------
// Relationship CRUD
// ---------------------------------------------------------------------------

export async function listRelationships(entityTypeId?: string): Promise<Relationship[]> {
  const db = getDb();

  const rows = await (entityTypeId
    ? db
        .select()
        .from(schemaRelationshipsTable)
        .where(
          sql`${schemaRelationshipsTable.fromEntityTypeId} = ${entityTypeId}
            OR ${schemaRelationshipsTable.toEntityTypeId} = ${entityTypeId}`,
        )
    : db.select().from(schemaRelationshipsTable));

  return rows.map((r) => ({
    ...r,
    cardinality: r.cardinality as "1:1" | "1:N" | "M:N",
    direction: r.direction as "from" | "to" | "both",
  }));
}

export async function createRelationship(
  input: CreateRelationshipInput,
): Promise<Relationship> {
  const db = getDb();

  // Validate both entity types exist
  await getEntityType(input.fromEntityTypeId);
  await getEntityType(input.toEntityTypeId);

  const validCardinalities = ["1:1", "1:N", "M:N"];
  if (!validCardinalities.includes(input.cardinality)) {
    throw new ServiceError(
      "VALIDATION_ERROR",
      `Invalid cardinality "${input.cardinality}". Must be one of: 1:1, 1:N, M:N`,
    );
  }

  const [row] = await db
    .insert(schemaRelationshipsTable)
    .values({
      fromEntityTypeId: input.fromEntityTypeId,
      toEntityTypeId: input.toEntityTypeId,
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

  await db
    .delete(schemaRelationshipsTable)
    .where(eq(schemaRelationshipsTable.id, id));
}

// ---------------------------------------------------------------------------
// Schema versioning
// ---------------------------------------------------------------------------

export async function publishSchema(): Promise<SchemaVersion> {
  const db = getDb();

  // Build the snapshot inside a transaction
  return await db.transaction(async (tx) => {
    // Get latest version number
    const [latestVersion] = await tx
      .select({ versionNumber: schemaVersionsTable.versionNumber })
      .from(schemaVersionsTable)
      .orderBy(sql`${schemaVersionsTable.versionNumber} DESC`)
      .limit(1);

    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    // Fetch all entity types, their fields, and relationships
    const entityTypes = await tx.select().from(schemaEntityTypesTable).orderBy(asc(schemaEntityTypesTable.name));
    const fields = await tx.select().from(schemaFieldsTable).orderBy(asc(schemaFieldsTable.displayOrder));
    const relationships = await tx.select().from(schemaRelationshipsTable);

    // Build snapshot
    const entityTypeMap = new Map<string, SnapshotEntityType>();
    for (const et of entityTypes) {
      entityTypeMap.set(et.id, {
        id: et.id,
        name: et.name,
        slug: et.slug,
        description: et.description,
        fields: [],
        relationships: [],
      });
    }

    for (const f of fields) {
      const et = entityTypeMap.get(f.entityTypeId);
      if (et) {
        et.fields.push({
          id: f.id,
          name: f.name,
          slug: f.slug,
          fieldType: f.fieldType as FieldType,
          required: f.required,
          displayOrder: f.displayOrder,
          config: f.config as FieldConfig,
        });
      }
    }

    for (const r of relationships) {
      const fromEt = entityTypeMap.get(r.fromEntityTypeId);
      if (fromEt) {
        fromEt.relationships.push({
          id: r.id,
          toEntityTypeId: r.toEntityTypeId,
          fromEntityTypeId: r.fromEntityTypeId,
          label: r.label,
          cardinality: r.cardinality as "1:1" | "1:N" | "M:N",
          direction: r.direction as "from" | "to" | "both",
        });
      }
    }

    const snapshot: SchemaSnapshot = {
      version: nextVersion,
      publishedAt: new Date().toISOString(),
      entityTypes: Array.from(entityTypeMap.values()),
    };

    // Mark previous current version as not current
    await tx
      .update(schemaVersionsTable)
      .set({ isCurrent: false })
      .where(eq(schemaVersionsTable.isCurrent, true));

    // Insert new version
    const [newVersion] = await tx
      .insert(schemaVersionsTable)
      .values({
        versionNumber: nextVersion,
        snapshot,
        isCurrent: true,
      })
      .returning();

    return {
      ...newVersion,
      snapshot: newVersion.snapshot as SchemaSnapshot,
    };
  });
}

export async function getCurrentPublishedSchema(): Promise<SchemaVersion | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(schemaVersionsTable)
    .where(eq(schemaVersionsTable.isCurrent, true))
    .limit(1);

  if (!row) return null;
  return { ...row, snapshot: row.snapshot as SchemaSnapshot };
}
