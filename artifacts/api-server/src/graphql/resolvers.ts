import { eq, and, inArray } from "drizzle-orm";
import {
  catalogEntriesTable,
  catalogFieldValuesTable,
  catalogEntryRelationshipsTable,
} from "@workspace/db";
import { fromStorageString } from "../services/coercionService";
import type { AttributeType } from "@workspace/db";
import type { GraphQLContext, ResolvedEntry, DbClient } from "./context";
import { applyFilterToEntries } from "./filters";

async function loadEntriesWithFieldValues(
  db: DbClient,
  entryIds: string[],
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

  const fieldValues = await db
    .select({
      entryId: catalogFieldValuesTable.entryId,
      attributeId: catalogFieldValuesTable.attributeId,
      value: catalogFieldValuesTable.valueText,
    })
    .from(catalogFieldValuesTable)
    .where(inArray(catalogFieldValuesTable.entryId, entryIds));

  const fvByEntry = new Map<string, Array<{ attributeId: string; value: string | null }>>();
  for (const fv of fieldValues) {
    if (!fvByEntry.has(fv.entryId)) fvByEntry.set(fv.entryId, []);
    fvByEntry.get(fv.entryId)!.push({ attributeId: fv.attributeId, value: fv.value });
  }

  return entries.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    templateId: e.templateId,
    fieldValues: fvByEntry.get(e.id) ?? [],
  }));
}

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

  const allFieldValues = await db
    .select({
      entryId: catalogFieldValuesTable.entryId,
      attributeId: catalogFieldValuesTable.attributeId,
      value: catalogFieldValuesTable.valueText,
    })
    .from(catalogFieldValuesTable)
    .where(
      inArray(
        catalogFieldValuesTable.entryId,
        entries.map((e) => e.id),
      ),
    );

  const fvByEntry = new Map<string, Array<{ attributeId: string; value: string | null }>>();
  for (const fv of allFieldValues) {
    if (!fvByEntry.has(fv.entryId)) fvByEntry.set(fv.entryId, []);
    fvByEntry.get(fv.entryId)!.push({ attributeId: fv.attributeId, value: fv.value });
  }

  let result: ResolvedEntry[] = entries.map((e) => ({
    id: e.id,
    displayName: e.displayName,
    templateId: e.templateId,
    fieldValues: fvByEntry.get(e.id) ?? [],
  }));

  if (args.where && typeof args.where === "object") {
    const tpl = snapshot.templates.find((t) => t.id === templateId);
    if (tpl) {
      const attrSlugToId = slugMap.attributeSlugToId[templateId] ?? {};
      result = applyFilterToEntries(result, args.where, attrSlugToId, slugMap.attributeIdToType);
    }
  }

  return result;
}

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

  const fieldValues = await db
    .select({
      entryId: catalogFieldValuesTable.entryId,
      attributeId: catalogFieldValuesTable.attributeId,
      value: catalogFieldValuesTable.valueText,
    })
    .from(catalogFieldValuesTable)
    .where(eq(catalogFieldValuesTable.entryId, entry.id));

  return {
    id: entry.id,
    displayName: entry.displayName,
    templateId: entry.templateId,
    fieldValues: fieldValues.map((fv) => ({ attributeId: fv.attributeId, value: fv.value })),
  };
}

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
    const links = await db
      .select({ toEntryId: catalogEntryRelationshipsTable.toEntryId })
      .from(catalogEntryRelationshipsTable)
      .where(
        and(
          eq(catalogEntryRelationshipsTable.fromEntryId, parent.id),
          eq(catalogEntryRelationshipsTable.relationshipId, relationshipId),
        ),
      );
    linkedEntryIds = links.map((l) => l.toEntryId);
  } else {
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

  void childContext;

  return loadEntriesWithFieldValues(db, linkedEntryIds);
}

export function attributeFieldResolver(
  attributeId: string,
  attributeType: AttributeType,
  parent: ResolvedEntry,
): unknown {
  const fv = parent.fieldValues.find((f) => f.attributeId === attributeId);
  return fromStorageString(fv?.value ?? null, attributeType);
}

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
