import { eq, asc, count, sql, inArray } from "drizzle-orm";
import {
  catalogsTable,
  catalogRolesTable,
  usersTable,
  schemaTemplatesTable,
  schemaSectionsTable,
  schemaAttributesTable,
  type CatalogStatus,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";
import { toSlug } from "../lib/utils";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
  templateCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCatalogInput {
  name: string;
  description?: string | null;
  creatorUserId?: string;
}

export interface UpdateCatalogInput {
  name?: string;
  description?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string> = {
  draft: "pilot",
  pilot: "published",
  published: "discontinued",
};

async function withTemplateCounts(rows: typeof catalogsTable.$inferSelect[]): Promise<Catalog[]> {
  const db = getDb();
  if (rows.length === 0) return [];

  const counts = await db
    .select({
      catalogId: schemaTemplatesTable.catalogId,
      templateCount: count(schemaTemplatesTable.id),
    })
    .from(schemaTemplatesTable)
    .groupBy(schemaTemplatesTable.catalogId);

  const countMap = new Map(counts.map((r) => [r.catalogId, Number(r.templateCount)]));

  return rows.map((r) => ({
    ...r,
    status: r.status as CatalogStatus,
    templateCount: countMap.get(r.id) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// Catalog CRUD
// ---------------------------------------------------------------------------

export async function listCatalogs(userId: string): Promise<Catalog[]> {
  const db = getDb();

  const [userRow] = await db
    .select({ systemRole: usersTable.systemRole })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!userRow) throw new ServiceError("NOT_FOUND", "User not found");

  if (userRow.systemRole === "platform_admin") {
    const rows = await db.select().from(catalogsTable).orderBy(asc(catalogsTable.name));
    return withTemplateCounts(rows);
  }

  const roleRows = await db
    .select({ catalogId: catalogRolesTable.catalogId })
    .from(catalogRolesTable)
    .where(eq(catalogRolesTable.userId, userId));

  if (roleRows.length === 0) return [];

  const catalogIds = roleRows.map((r) => r.catalogId);
  const rows = await db
    .select()
    .from(catalogsTable)
    .where(inArray(catalogsTable.id, catalogIds))
    .orderBy(asc(catalogsTable.name));

  return withTemplateCounts(rows);
}

export async function getCatalog(id: string): Promise<Catalog> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(catalogsTable)
    .where(eq(catalogsTable.id, id))
    .limit(1);

  if (!row) {
    throw new ServiceError("NOT_FOUND", `Catalog "${id}" not found`);
  }

  const [countRow] = await db
    .select({ count: count(schemaTemplatesTable.id) })
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.catalogId, id));

  return {
    ...row,
    status: row.status as CatalogStatus,
    templateCount: Number(countRow?.count ?? 0),
  };
}

export async function createCatalog(input: CreateCatalogInput): Promise<Catalog> {
  const db = getDb();

  const existing = await db
    .select({ id: catalogsTable.id })
    .from(catalogsTable)
    .where(eq(catalogsTable.name, input.name))
    .limit(1);

  if (existing.length > 0) {
    throw new ServiceError("CONFLICT", `A catalog named "${input.name}" already exists`);
  }

  const row = await db.transaction(async (tx) => {
    const [catalog] = await tx
      .insert(catalogsTable)
      .values({
        name: input.name,
        description: input.description ?? null,
        status: "draft",
      })
      .returning();

    // A-04: assign creator as catalog_admin in the same transaction
    if (input.creatorUserId) {
      await tx.insert(catalogRolesTable).values({
        catalogId: catalog.id,
        userId: input.creatorUserId,
        catalogRole: "catalog_admin",
        assignedBy: input.creatorUserId,
      });
    }

    return catalog;
  });

  return { ...row, status: "draft", templateCount: 0 };
}

export async function updateCatalog(id: string, input: UpdateCatalogInput): Promise<Catalog> {
  const db = getDb();
  const catalog = await getCatalog(id);

  if (input.name && input.name !== catalog.name) {
    const conflict = await db
      .select({ id: catalogsTable.id })
      .from(catalogsTable)
      .where(eq(catalogsTable.name, input.name))
      .limit(1);

    if (conflict.length > 0) {
      throw new ServiceError("CONFLICT", `A catalog named "${input.name}" already exists`);
    }
  }

  const [updated] = await db
    .update(catalogsTable)
    .set({
      name: input.name ?? catalog.name,
      description: input.description !== undefined ? input.description : catalog.description,
      updatedAt: new Date(),
    })
    .where(eq(catalogsTable.id, id))
    .returning();

  return { ...updated, status: updated.status as CatalogStatus, templateCount: catalog.templateCount };
}

export async function transitionStatus(id: string, targetStatus: string): Promise<Catalog> {
  const db = getDb();
  const catalog = await getCatalog(id);

  const allowedNext = VALID_TRANSITIONS[catalog.status];
  if (allowedNext !== targetStatus) {
    throw new ServiceError(
      "CATALOG_INVALID_TRANSITION",
      `Cannot transition catalog from "${catalog.status}" to "${targetStatus}". ` +
        (allowedNext
          ? `The only allowed next status is "${allowedNext}".`
          : `"${catalog.status}" is a terminal status.`),
    );
  }

  const [updated] = await db
    .update(catalogsTable)
    .set({ status: targetStatus, updatedAt: new Date() })
    .where(eq(catalogsTable.id, id))
    .returning();

  return { ...updated, status: updated.status as CatalogStatus, templateCount: catalog.templateCount };
}

export async function duplicateCatalog(id: string, creatorUserId?: string): Promise<Catalog> {
  const db = getDb();
  const source = await getCatalog(id);

  // Find unique name for the copy
  const baseName = `${source.name} (Copy)`;
  let copyName = baseName;
  let attempt = 1;
  while (true) {
    const conflict = await db
      .select({ id: catalogsTable.id })
      .from(catalogsTable)
      .where(eq(catalogsTable.name, copyName))
      .limit(1);
    if (conflict.length === 0) break;
    attempt++;
    copyName = `${baseName} ${attempt}`;
    if (attempt > 20) {
      throw new ServiceError("CONFLICT", "Cannot generate a unique name for the catalog copy");
    }
  }

  // Create new catalog in draft and optionally assign creator as catalog_admin
  const [newCatalog] = await db
    .insert(catalogsTable)
    .values({
      name: copyName,
      description: source.description,
      status: "draft",
    })
    .returning();

  if (creatorUserId) {
    await db.insert(catalogRolesTable).values({
      catalogId: newCatalog.id,
      userId: creatorUserId,
      catalogRole: "catalog_admin",
      assignedBy: creatorUserId,
    });
  }

  // Copy all templates (with their sections and attributes)
  const templates = await db
    .select()
    .from(schemaTemplatesTable)
    .where(eq(schemaTemplatesTable.catalogId, id))
    .orderBy(asc(schemaTemplatesTable.name));

  for (const tpl of templates) {
    const [newTpl] = await db
      .insert(schemaTemplatesTable)
      .values({
        catalogId: newCatalog.id,
        name: tpl.name,
        slug: tpl.slug,
        description: tpl.description,
        isSystemSeed: tpl.isSystemSeed,
        isReferenceData: tpl.isReferenceData,
      })
      .returning();

    const sections = await db
      .select()
      .from(schemaSectionsTable)
      .where(eq(schemaSectionsTable.templateId, tpl.id))
      .orderBy(asc(schemaSectionsTable.displayOrder));

    for (const sec of sections) {
      const [newSec] = await db
        .insert(schemaSectionsTable)
        .values({
          templateId: newTpl.id,
          name: sec.name,
          description: sec.description,
          displayOrder: sec.displayOrder,
        })
        .returning();

      const attrs = await db
        .select()
        .from(schemaAttributesTable)
        .where(eq(schemaAttributesTable.sectionId, sec.id))
        .orderBy(asc(schemaAttributesTable.displayOrder));

      for (const attr of attrs) {
        await db.insert(schemaAttributesTable).values({
          sectionId: newSec.id,
          name: attr.name,
          slug: toSlug(attr.name),
          description: attr.description,
          attributeType: attr.attributeType,
          required: attr.required,
          displayOrder: attr.displayOrder,
          config: attr.config,
        });
      }
    }
  }

  return {
    ...newCatalog,
    status: "draft" as CatalogStatus,
    templateCount: templates.length,
  };
}
