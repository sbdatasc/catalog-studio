import { eq, asc, count } from "drizzle-orm";
import {
  referenceDatasetsTable,
  referenceValuesTable,
  schemaAttributesTable,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface ReferenceDataset {
  id: string;
  name: string;
  description: string | null;
  valueCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceDatasetWithValues extends ReferenceDataset {
  values: ReferenceValue[];
}

export interface ReferenceValue {
  id: string;
  datasetId: string;
  label: string;
  value: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateDatasetInput {
  name: string;
  description?: string | null;
}

export interface UpdateDatasetInput {
  name?: string;
  description?: string | null;
}

export interface CreateValueInput {
  label: string;
  value?: string;
  displayOrder?: number;
}

export interface UpdateValueInput {
  label?: string;
  value?: string;
  displayOrder?: number;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchValueCount(datasetId: string): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ c: count(referenceValuesTable.id) })
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, datasetId));
  return Number(row?.c ?? 0);
}

// ---------------------------------------------------------------------------
// Dataset CRUD
// ---------------------------------------------------------------------------

export async function listDatasets(): Promise<ReferenceDataset[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: referenceDatasetsTable.id,
      name: referenceDatasetsTable.name,
      description: referenceDatasetsTable.description,
      createdAt: referenceDatasetsTable.createdAt,
      updatedAt: referenceDatasetsTable.updatedAt,
      valueCount: count(referenceValuesTable.id),
    })
    .from(referenceDatasetsTable)
    .leftJoin(referenceValuesTable, eq(referenceValuesTable.datasetId, referenceDatasetsTable.id))
    .groupBy(
      referenceDatasetsTable.id,
      referenceDatasetsTable.name,
      referenceDatasetsTable.description,
      referenceDatasetsTable.createdAt,
      referenceDatasetsTable.updatedAt,
    )
    .orderBy(asc(referenceDatasetsTable.name));
  return rows;
}

export async function getDataset(id: string): Promise<ReferenceDatasetWithValues> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("NOT_FOUND", `Reference dataset "${id}" not found`);
  }

  const values = await db
    .select()
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, id))
    .orderBy(asc(referenceValuesTable.displayOrder));

  return { ...row, valueCount: values.length, values };
}

export async function createDataset(input: CreateDatasetInput): Promise<ReferenceDataset> {
  const db = getDb();

  const existing = await db
    .select({ id: referenceDatasetsTable.id })
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.name, input.name))
    .limit(1);

  if (existing.length > 0) {
    throw new ServiceError("CONFLICT", `A reference dataset named "${input.name}" already exists`);
  }

  const [row] = await db
    .insert(referenceDatasetsTable)
    .values({ name: input.name, description: input.description ?? null })
    .returning();

  return { ...row, valueCount: 0 };
}

export async function updateDataset(
  id: string,
  input: UpdateDatasetInput,
): Promise<ReferenceDataset> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Reference dataset "${id}" not found`);
  }

  if (input.name && input.name !== existing.name) {
    const conflict = await db
      .select({ id: referenceDatasetsTable.id })
      .from(referenceDatasetsTable)
      .where(eq(referenceDatasetsTable.name, input.name))
      .limit(1);
    if (conflict.length > 0) {
      throw new ServiceError("CONFLICT", `A reference dataset named "${input.name}" already exists`);
    }
  }

  const [updated] = await db
    .update(referenceDatasetsTable)
    .set({
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      updatedAt: new Date(),
    })
    .where(eq(referenceDatasetsTable.id, id))
    .returning();

  const valueCount = await fetchValueCount(id);
  return { ...updated, valueCount };
}

export async function deleteDataset(id: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Reference dataset "${id}" not found`);
  }

  const { sql: rawSql } = await import("drizzle-orm");
  const [inUse] = await db
    .select({ id: schemaAttributesTable.id })
    .from(schemaAttributesTable)
    .where(rawSql`${schemaAttributesTable.config}->>'referenceDatasetId' = ${id}`)
    .limit(1);

  if (inUse) {
    throw new ServiceError(
      "REFERENCE_DATA_IN_USE",
      `Reference dataset "${existing.name}" is referenced by one or more attributes and cannot be deleted`,
    );
  }

  await db.delete(referenceDatasetsTable).where(eq(referenceDatasetsTable.id, id));
}

// ---------------------------------------------------------------------------
// Value CRUD
// ---------------------------------------------------------------------------

export async function listValues(datasetId: string): Promise<ReferenceValue[]> {
  const db = getDb();

  const [dataset] = await db
    .select({ id: referenceDatasetsTable.id })
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.id, datasetId))
    .limit(1);

  if (!dataset) {
    throw new ServiceError("NOT_FOUND", `Reference dataset "${datasetId}" not found`);
  }

  return db
    .select()
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, datasetId))
    .orderBy(asc(referenceValuesTable.displayOrder));
}

export async function createValue(
  datasetId: string,
  input: CreateValueInput,
): Promise<ReferenceValue> {
  const db = getDb();

  const [dataset] = await db
    .select({ id: referenceDatasetsTable.id })
    .from(referenceDatasetsTable)
    .where(eq(referenceDatasetsTable.id, datasetId))
    .limit(1);

  if (!dataset) {
    throw new ServiceError("NOT_FOUND", `Reference dataset "${datasetId}" not found`);
  }

  const storedValue = input.value ?? input.label;

  const conflict = await db
    .select({ id: referenceValuesTable.id })
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, datasetId))
    .where(eq(referenceValuesTable.value, storedValue))
    .limit(1);

  if (conflict.length > 0) {
    throw new ServiceError("CONFLICT", `A value "${storedValue}" already exists in this dataset`);
  }

  const [existing] = await db
    .select({ displayOrder: referenceValuesTable.displayOrder })
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, datasetId))
    .orderBy(asc(referenceValuesTable.displayOrder));

  const maxOrderRow = await db
    .select({ maxOrder: referenceValuesTable.displayOrder })
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.datasetId, datasetId))
    .orderBy(asc(referenceValuesTable.displayOrder));

  const nextOrder =
    input.displayOrder ?? (maxOrderRow.length > 0 ? maxOrderRow.length : 0);
  void existing;

  const [row] = await db
    .insert(referenceValuesTable)
    .values({
      datasetId,
      label: input.label,
      value: storedValue,
      displayOrder: nextOrder,
    })
    .returning();

  return row;
}

export async function updateValue(
  id: string,
  input: UpdateValueInput,
): Promise<ReferenceValue> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Reference value "${id}" not found`);
  }

  if (input.value && input.value !== existing.value) {
    const conflict = await db
      .select({ id: referenceValuesTable.id })
      .from(referenceValuesTable)
      .where(eq(referenceValuesTable.datasetId, existing.datasetId))
      .where(eq(referenceValuesTable.value, input.value))
      .limit(1);
    if (conflict.length > 0) {
      throw new ServiceError("CONFLICT", `A value "${input.value}" already exists in this dataset`);
    }
  }

  const [updated] = await db
    .update(referenceValuesTable)
    .set({
      label: input.label ?? existing.label,
      value: input.value ?? existing.value,
      displayOrder: input.displayOrder ?? existing.displayOrder,
      isActive: input.isActive ?? existing.isActive,
    })
    .where(eq(referenceValuesTable.id, id))
    .returning();

  return updated;
}

export async function deleteValue(id: string): Promise<void> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(referenceValuesTable)
    .where(eq(referenceValuesTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Reference value "${id}" not found`);
  }

  await db.delete(referenceValuesTable).where(eq(referenceValuesTable.id, id));
}

export async function reorderValues(datasetId: string, orderedIds: string[]): Promise<void> {
  const db = getDb();

  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(referenceValuesTable)
        .set({ displayOrder: i })
        .where(eq(referenceValuesTable.id, orderedIds[i]));
    }
  });
}
