import { eq, and, inArray } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogEntryRelationshipsTable,
} from "@workspace/db";
import { fromStorageString } from "../services/coercionService";
import type { AttributeType } from "@workspace/db";
import type { GraphQLContext, ResolvedEntry, DbClient } from "./context";
import { applyFilterToEntries } from "./filters";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function loadEntriesWithFieldValues(
  db: DbClient,
  entryIds: string[],
  context: GraphQLContext,
): Promise<ResolvedEntry[]> {
  if (entryIds.length === 0) return [];

  const entries = await db
    .select({
      id: catalogEntriesTable.id,
      displayName: catalogEntriesTable.displayName,
      templateId: catalogEntriesTable.templateId,
    })
    .from(catalogEntriesTable)
    .where(inArray(catalogEntriesTable.id, entryIds));

  // Batch-load all field values via DataLoader
  const fvBatches = await context.loaders.entryFieldValues.loadMany(entries.map((e) => e.id));

  return entries.map((e, i) => {
    const fvs = fvBatches[i];
    return {
      id: e.id,
      displayName: e.displayName,
      templateId: e.templateId,
      fieldValues: fvs instanceof Error ? [] : fvs,
    };
  });
}

// ---------------------------------------------------------------------------
// Root list resolver
// ---------------------------------------------------------------------------

export async function rootListResolver(
  templateId: string,
  _parent: unknown,
  args: { where?: Record<string, unknown> },
  context: GraphQLContext,
): Promise<ResolvedEntry[]> {
  const { db, catalogId, snapshot, slugMap } = context;

  const entries = await db
    .select({
      id: catalogEntriesTable.id,
      displayName: catalogEntriesTable.displayName,
      templateId: catalogEntriesTable.templateId,
    })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.catalogId, catalogId),
        eq(catalogEntriesTable.templateId, templateId),
      ),
    );

  if (entries.length === 0) return [];

  // Batch-load field values for all entries in one DataLoader call
  const fvBatches = await context.loaders.entryFieldValues.loadMany(entries.map((e) => e.id));

  let result: ResolvedEntry[] = entries.map((e, i) => {
    const fvs = fvBatches[i];
    return {
      id: e.id,
      displayName: e.displayName,
      templateId: e.templateId,
      fieldValues: fvs instanceof Error ? [] : fvs,
    };
  });

  if (args.where && typeof args.where === "object") {
    const tpl = snapshot.templates.find((t) => t.id === templateId);
    if (tpl) {
      const attrSlugToId = slugMap.attributeSlugToId[templateId] ?? {};
      result = applyFilterToEntries(result, args.where, attrSlugToId, slugMap.attributeIdToType);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Root single resolver
// ---------------------------------------------------------------------------

export async function rootSingleResolver(
  _parent: unknown,
  args: { id: string },
  context: GraphQLContext,
): Promise<ResolvedEntry | null> {
  const { db, catalogId } = context;

  const [entry] = await db
    .select({
      id: catalogEntriesTable.id,
      displayName: catalogEntriesTable.displayName,
      templateId: catalogEntriesTable.templateId,
    })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.id, args.id),
        eq(catalogEntriesTable.catalogId, catalogId),
      ),
    )
    .limit(1);

  if (!entry) return null;

  // Use DataLoader for field values (participates in request-level batching)
  const fvs = await context.loaders.entryFieldValues.load(entry.id);

  return {
    id: entry.id,
    displayName: entry.displayName,
    templateId: entry.templateId,
    fieldValues: fvs instanceof Error ? [] : fvs,
  };
}

// ---------------------------------------------------------------------------
// Relationship field resolver — uses DataLoader for from-side batching
// ---------------------------------------------------------------------------

export async function relationshipFieldResolver(
  relationshipId: string,
  side: "from" | "to",
  parent: ResolvedEntry,
  _args: unknown,
  context: GraphQLContext,
): Promise<ResolvedEntry[] | ResolvedEntry | null> {
  if (context.depth >= 3) return null;

  const { db } = context;
  const childContext: GraphQLContext = { ...context, depth: context.depth + 1 };

  let linkedEntryIds: string[];

  if (side === "from") {
    // Use DataLoader — batches all sibling resolver calls into a single query
    const links = await context.loaders.relationshipLinks.load({
      fromEntryId: parent.id,
      relationshipId,
    });
    linkedEntryIds = links.map((l) => l.toEntryId);
  } else {
    // Reverse (to) side — direct query (uncommon; not worth a second loader at MVP 2 scale)
    const links = await db
      .select({ fromEntryId: catalogEntryRelationshipsTable.fromEntryId })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.toEntryId, parent.id),
          eq(catalogEntryRelationshipsTable.relationshipId, relationshipId),
        ),
      );
    linkedEntryIds = links.map((l) => l.fromEntryId);
  }

  return loadEntriesWithFieldValues(db, linkedEntryIds, childContext);
}

// ---------------------------------------------------------------------------
// Attribute field resolver — synchronous, reads from pre-loaded field values
// ---------------------------------------------------------------------------

export function attributeFieldResolver(
  attributeId: string,
  attributeType: AttributeType,
  parent: ResolvedEntry,
): unknown {
  const fv = parent.fieldValues.find((f) => f.attributeId === attributeId);
  return fromStorageString(fv?.value ?? null, attributeType);
}

// ---------------------------------------------------------------------------
// Ref-data field resolver — resolves display name for reference_data attributes
// ---------------------------------------------------------------------------

export async function refDataFieldResolver(
  attributeId: string,
  parent: ResolvedEntry,
  context: GraphQLContext,
): Promise<string | null> {
  const fv = parent.fieldValues.find((f) => f.attributeId === attributeId);
  const uuid = fv?.value ?? null;
  if (!uuid) return null;

  const [refEntry] = await context.db
    .select({ displayName: catalogEntriesTable.displayName })
    .from(catalogEntriesTable)
    .where(eq(catalogEntriesTable.id, uuid))
    .limit(1);

  return refEntry?.displayName ?? null;
}
