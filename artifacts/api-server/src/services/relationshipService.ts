import { eq, and, sql } from "drizzle-orm";
import {
  catalogsTable,
  schemaRelationshipsTable,
  schemaTemplatesTable,
  catalogEntryRelationshipsTable,
} from "@workspace/db";
import { getDb } from "../db/connection";
import { ServiceError } from "../lib/errors";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface RelationshipDefinition {
  id: string;
  catalogId: string;
  fromTemplateId: string;
  toTemplateId: string;
  fromTemplateName: string;
  toTemplateName: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
  entryLinkCount: number;
  createdAt: string;
}

export interface NodePosition {
  templateId: string;
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// Helper — assert catalog exists and is draft
// ---------------------------------------------------------------------------

async function assertCatalogDraft(catalogId: string): Promise<void> {
  const db = getDb();
  const [catalog] = await db
    .select({ id: catalogsTable.id, status: catalogsTable.status })
    .from(catalogsTable)
    .where(eq(catalogsTable.id, catalogId))
    .limit(1);

  if (!catalog) {
    throw new ServiceError("NOT_FOUND", `Catalog "${catalogId}" not found`);
  }
  if (catalog.status !== "draft") {
    throw new ServiceError(
      "CATALOG_LOCKED",
      "This catalog is locked. Duplicate it to make changes.",
    );
  }
}

// ---------------------------------------------------------------------------
// Helper — get catalog_id for a relationship (from template join)
// ---------------------------------------------------------------------------

async function getCatalogIdForRelationship(
  relationshipId: string,
): Promise<{ catalogId: string; status: string }> {
  const db = getDb();

  const fromTemplate = schemaTemplatesTable;
  const [row] = await db
    .select({
      catalogId: fromTemplate.catalogId,
      status: catalogsTable.status,
    })
    .from(schemaRelationshipsTable)
    .innerJoin(fromTemplate, eq(schemaRelationshipsTable.fromTemplateId, fromTemplate.id))
    .innerJoin(catalogsTable, eq(fromTemplate.catalogId, catalogsTable.id))
    .where(eq(schemaRelationshipsTable.id, relationshipId))
    .limit(1);

  return row ?? { catalogId: "", status: "" };
}

// ---------------------------------------------------------------------------
// listRelationships — keyed by catalogId
// ---------------------------------------------------------------------------

export async function listRelationships(
  catalogId: string,
): Promise<RelationshipDefinition[]> {
  const db = getDb();

  const fromT = schemaTemplatesTable;
  const toT = { ...schemaTemplatesTable } as typeof schemaTemplatesTable;

  // Build the query joining from/to template names
  const rows = await db.execute(sql`
    SELECT
      r.id,
      ft.catalog_id          AS "catalogId",
      r.from_template_id     AS "fromTemplateId",
      r.to_template_id       AS "toTemplateId",
      ft.name                AS "fromTemplateName",
      tt.name                AS "toTemplateName",
      r.label,
      r.cardinality,
      r.direction,
      r.created_at           AS "createdAt",
      COUNT(er.id)::int      AS "entryLinkCount"
    FROM schema_relationships r
    INNER JOIN schema_templates ft ON r.from_template_id = ft.id
    INNER JOIN schema_templates tt ON r.to_template_id   = tt.id
    LEFT  JOIN catalog_entry_relationships er ON er.relationship_id = r.id
    WHERE ft.catalog_id = ${catalogId}
    GROUP BY r.id, ft.catalog_id, ft.name, tt.name
    ORDER BY r.created_at ASC
  `);

  return (rows.rows as Array<Record<string, unknown>>).map((r) => ({
    id: r["id"] as string,
    catalogId: r["catalogId"] as string,
    fromTemplateId: r["fromTemplateId"] as string,
    toTemplateId: r["toTemplateId"] as string,
    fromTemplateName: r["fromTemplateName"] as string,
    toTemplateName: r["toTemplateName"] as string,
    label: r["label"] as string,
    cardinality: r["cardinality"] as "1:1" | "1:N" | "M:N",
    direction: r["direction"] as "from" | "to" | "both",
    entryLinkCount: Number(r["entryLinkCount"] ?? 0),
    createdAt: (r["createdAt"] as Date).toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// createRelationship
// ---------------------------------------------------------------------------

export interface CreateRelationshipInput {
  catalogId: string;
  fromTemplateId: string;
  toTemplateId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
}

export async function createRelationship(
  input: CreateRelationshipInput,
): Promise<RelationshipDefinition> {
  await assertCatalogDraft(input.catalogId);

  const db = getDb();

  // Verify both templates belong to this catalog
  const [fromT] = await db
    .select({ id: schemaTemplatesTable.id, name: schemaTemplatesTable.name })
    .from(schemaTemplatesTable)
    .where(
      and(
        eq(schemaTemplatesTable.id, input.fromTemplateId),
        eq(schemaTemplatesTable.catalogId, input.catalogId),
      ),
    )
    .limit(1);

  if (!fromT) {
    throw new ServiceError("NOT_FOUND", `From template "${input.fromTemplateId}" not found in this catalog`);
  }

  const [toT] = await db
    .select({ id: schemaTemplatesTable.id, name: schemaTemplatesTable.name })
    .from(schemaTemplatesTable)
    .where(
      and(
        eq(schemaTemplatesTable.id, input.toTemplateId),
        eq(schemaTemplatesTable.catalogId, input.catalogId),
      ),
    )
    .limit(1);

  if (!toT) {
    throw new ServiceError("NOT_FOUND", `To template "${input.toTemplateId}" not found in this catalog`);
  }

  // Check duplicate: same from+to+label
  const [existing] = await db
    .select({ id: schemaRelationshipsTable.id })
    .from(schemaRelationshipsTable)
    .where(
      and(
        eq(schemaRelationshipsTable.fromTemplateId, input.fromTemplateId),
        eq(schemaRelationshipsTable.toTemplateId, input.toTemplateId),
        eq(schemaRelationshipsTable.label, input.label),
      ),
    )
    .limit(1);

  if (existing) {
    throw new ServiceError(
      "CONFLICT",
      "A relationship with this label already exists between these templates.",
    );
  }

  const [row] = await db
    .insert(schemaRelationshipsTable)
    .values({
      fromTemplateId: input.fromTemplateId,
      toTemplateId: input.toTemplateId,
      label: input.label,
      cardinality: input.cardinality,
      direction: input.direction,
    })
    .returning();

  return {
    id: row.id,
    catalogId: input.catalogId,
    fromTemplateId: row.fromTemplateId,
    toTemplateId: row.toTemplateId,
    fromTemplateName: fromT.name,
    toTemplateName: toT.name,
    label: row.label,
    cardinality: row.cardinality as "1:1" | "1:N" | "M:N",
    direction: row.direction as "from" | "to" | "both",
    entryLinkCount: 0,
    createdAt: row.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// updateRelationship — label, cardinality, direction only
// ---------------------------------------------------------------------------

export interface UpdateRelationshipInput {
  label?: string;
  cardinality?: "1:1" | "1:N" | "M:N";
  direction?: "from" | "to" | "both";
}

export async function updateRelationship(
  id: string,
  input: UpdateRelationshipInput,
): Promise<RelationshipDefinition> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schemaRelationshipsTable)
    .where(eq(schemaRelationshipsTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Relationship "${id}" not found`);
  }

  const { catalogId, status } = await getCatalogIdForRelationship(id);
  if (status !== "draft") {
    throw new ServiceError(
      "CATALOG_LOCKED",
      "This catalog is locked. Duplicate it to make changes.",
    );
  }

  // Check CONFLICT if label is changing
  if (input.label && input.label !== existing.label) {
    const [dup] = await db
      .select({ id: schemaRelationshipsTable.id })
      .from(schemaRelationshipsTable)
      .where(
        and(
          eq(schemaRelationshipsTable.fromTemplateId, existing.fromTemplateId),
          eq(schemaRelationshipsTable.toTemplateId, existing.toTemplateId),
          eq(schemaRelationshipsTable.label, input.label),
        ),
      )
      .limit(1);

    if (dup) {
      throw new ServiceError(
        "CONFLICT",
        "A relationship with this label already exists between these templates.",
      );
    }
  }

  const [updated] = await db
    .update(schemaRelationshipsTable)
    .set({
      ...(input.label !== undefined && { label: input.label }),
      ...(input.cardinality !== undefined && { cardinality: input.cardinality }),
      ...(input.direction !== undefined && { direction: input.direction }),
    })
    .where(eq(schemaRelationshipsTable.id, id))
    .returning();

  // Fetch template names and entry link count
  const [full] = await listRelationships(catalogId).then((rels) =>
    rels.filter((r) => r.id === id),
  );

  return full ?? {
    id: updated.id,
    catalogId,
    fromTemplateId: updated.fromTemplateId,
    toTemplateId: updated.toTemplateId,
    fromTemplateName: "",
    toTemplateName: "",
    label: updated.label,
    cardinality: updated.cardinality as "1:1" | "1:N" | "M:N",
    direction: updated.direction as "from" | "to" | "both",
    entryLinkCount: 0,
    createdAt: updated.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// deleteRelationship
// ---------------------------------------------------------------------------

export async function deleteRelationship(id: string): Promise<{ entryLinkCount: number }> {
  const db = getDb();

  const [existing] = await db
    .select()
    .from(schemaRelationshipsTable)
    .where(eq(schemaRelationshipsTable.id, id))
    .limit(1);

  if (!existing) {
    throw new ServiceError("NOT_FOUND", `Relationship "${id}" not found`);
  }

  const { status } = await getCatalogIdForRelationship(id);
  if (status !== "draft") {
    throw new ServiceError(
      "CATALOG_LOCKED",
      "This catalog is locked. Duplicate it to make changes.",
    );
  }

  // Count entry links before deleting
  const [{ linkCount }] = await db
    .select({ linkCount: sql<number>`COUNT(*)::int` })
    .from(catalogEntryRelationshipsTable)
    .where(eq(catalogEntryRelationshipsTable.relationshipId, id));

  // Cascade-delete entry links first (no FK constraint in schema)
  if (linkCount > 0) {
    await db
      .delete(catalogEntryRelationshipsTable)
      .where(eq(catalogEntryRelationshipsTable.relationshipId, id));
  }

  await db
    .delete(schemaRelationshipsTable)
    .where(eq(schemaRelationshipsTable.id, id));

  return { entryLinkCount: linkCount };
}

// ---------------------------------------------------------------------------
// Node positions
// ---------------------------------------------------------------------------

export async function getNodePositions(catalogId: string): Promise<NodePosition[]> {
  const db = getDb();

  const rows = await db.execute(sql`
    SELECT template_id AS "templateId", x::float AS x, y::float AS y
    FROM catalog_node_positions
    WHERE catalog_id = ${catalogId}
  `);

  return (rows.rows as Array<{ templateId: string; x: number; y: number }>).map((r) => ({
    templateId: r.templateId,
    x: Number(r.x),
    y: Number(r.y),
  }));
}

export async function saveNodePositions(
  catalogId: string,
  positions: NodePosition[],
): Promise<void> {
  if (positions.length === 0) return;

  const db = getDb();

  // Upsert each position: INSERT ... ON CONFLICT (catalog_id, template_id) DO UPDATE
  for (const pos of positions) {
    await db.execute(sql`
      INSERT INTO catalog_node_positions (catalog_id, template_id, x, y, updated_at)
      VALUES (${catalogId}, ${pos.templateId}, ${pos.x}, ${pos.y}, now())
      ON CONFLICT (catalog_id, template_id)
      DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y, updated_at = now()
    `);
  }
}
