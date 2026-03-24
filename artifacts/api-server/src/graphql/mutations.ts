import {
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLUnionType,
  GraphQLString,
  GraphQLID,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLList,
  GraphQLError,
} from "graphql";
import { eq, and } from "drizzle-orm";
import { catalogEntriesTable } from "@workspace/db";
import type { SchemaSnapshot } from "@workspace/db";
import * as entryService from "../services/entryService";
import type { GraphQLContext, DbClient, ResolvedEntry, SlugMap } from "./context";

// ---------------------------------------------------------------------------
// UUID regex — used to bypass display_name resolution
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// FieldInput input type
// ---------------------------------------------------------------------------

export const FieldInputType = new GraphQLInputObjectType({
  name: "FieldInput",
  fields: {
    attributeSlug: { type: new GraphQLNonNull(GraphQLString) },
    value: { type: GraphQLString },
  },
});

// ---------------------------------------------------------------------------
// LinkResult output type
// ---------------------------------------------------------------------------

export const LinkResultType = new GraphQLObjectType({
  name: "LinkResult",
  fields: {
    id: { type: new GraphQLNonNull(GraphQLID) },
    fromEntryId: { type: new GraphQLNonNull(GraphQLID) },
    toEntryId: { type: new GraphQLNonNull(GraphQLID) },
    relationshipId: { type: new GraphQLNonNull(GraphQLID) },
  },
});

// ---------------------------------------------------------------------------
// assertCanMutate — FORBIDDEN for Viewer and Designer
// ---------------------------------------------------------------------------

export function assertCanMutate(context: GraphQLContext): void {
  const role = context.userCatalogRole;
  const canMutate =
    role === "platform_admin" ||
    (role !== null && ["catalog_admin", "steward", "api_consumer"].includes(role));
  if (!canMutate) {
    throw new GraphQLError("Insufficient permissions to perform mutations.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

// ---------------------------------------------------------------------------
// resolveReferenceField — UUID bypass or exact display_name match
// ---------------------------------------------------------------------------

export async function resolveReferenceField(
  value: string,
  targetTemplateId: string,
  catalogId: string,
  db: DbClient,
): Promise<string> {
  if (UUID_REGEX.test(value)) return value;

  const matches = await db
    .select({ id: catalogEntriesTable.id })
    .from(catalogEntriesTable)
    .where(
      and(
        eq(catalogEntriesTable.templateId, targetTemplateId),
        eq(catalogEntriesTable.catalogId, catalogId),
        eq(catalogEntriesTable.displayName, value),
      ),
    );

  if (matches.length === 0) {
    throw new GraphQLError(`No entry found with display_name "${value}"`, {
      extensions: { code: "REFERENCE_NOT_FOUND" },
    });
  }
  if (matches.length > 1) {
    throw new GraphQLError(
      `Multiple entries found with display_name "${value}". Use entry ID directly.`,
      { extensions: { code: "AMBIGUOUS_REFERENCE" } },
    );
  }
  return matches[0].id;
}

// ---------------------------------------------------------------------------
// resolveFields — slug → id, reference resolution for ref/ref_data fields
// ---------------------------------------------------------------------------

interface FieldInput {
  attributeSlug: string;
  value?: string | null;
}

export async function resolveFields(
  fields: FieldInput[],
  templateId: string,
  slugMap: SlugMap,
  catalogId: string,
  db: DbClient,
): Promise<Array<{ attributeId: string; value: string | null }>> {
  const attrSlugToId = slugMap.attributeSlugToId[templateId] ?? {};
  const resolved: Array<{ attributeId: string; value: string | null }> = [];

  for (const field of fields) {
    const attributeId = attrSlugToId[field.attributeSlug];
    if (!attributeId) {
      throw new GraphQLError(
        `Unknown attribute slug "${field.attributeSlug}" on template`,
        { extensions: { code: "NOT_FOUND" } },
      );
    }

    const attrType = slugMap.attributeIdToType[attributeId];
    const attrConfig = slugMap.attributeIdToConfig[attributeId] as
      | { targetTemplateId?: string }
      | null;

    let resolvedValue = field.value ?? null;

    if (
      resolvedValue !== null &&
      (attrType === "reference" || attrType === "reference_data")
    ) {
      const targetTemplateId = attrConfig?.targetTemplateId;
      if (targetTemplateId) {
        resolvedValue = await resolveReferenceField(resolvedValue, targetTemplateId, catalogId, db);
      }
    }

    resolved.push({ attributeId, value: resolvedValue });
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// formatEntryAsResolvedEntry — CatalogEntry → ResolvedEntry for GraphQL
// ---------------------------------------------------------------------------

function formatEntryAsResolvedEntry(entry: entryService.CatalogEntry): ResolvedEntry {
  return {
    id: entry.id,
    displayName: entry.displayName,
    templateId: entry.templateId,
    fieldValues: entry.fieldValues.map((fv) => ({
      attributeId: fv.attributeId,
      value: fv.value,
    })),
  };
}

// ---------------------------------------------------------------------------
// buildMutationRoot — returns GraphQLObjectType for MutationRoot
// ---------------------------------------------------------------------------

export function buildMutationRoot(
  _snapshot: SchemaSnapshot,
  objectTypes: Map<string, GraphQLObjectType>,
  slugMap: SlugMap,
): GraphQLObjectType {
  const allTemplateTypes = Array.from(objectTypes.values());

  // Build a Union return type for createEntry / updateEntry so each mutation
  // can return the appropriate template-specific object type.
  // resolveType discriminates by templateId on the returned ResolvedEntry.
  let entryReturnType: GraphQLObjectType | GraphQLUnionType;

  if (allTemplateTypes.length === 0) {
    // Fallback: generic entry stub (no templates defined yet)
    entryReturnType = new GraphQLObjectType({
      name: "EntryResult",
      fields: {
        id: { type: new GraphQLNonNull(GraphQLID) },
        displayName: { type: GraphQLString },
      },
    });
  } else if (allTemplateTypes.length === 1) {
    entryReturnType = allTemplateTypes[0];
  } else {
    entryReturnType = new GraphQLUnionType({
      name: "EntryResult",
      types: allTemplateTypes,
      resolveType: (value: unknown) => {
        const entry = value as ResolvedEntry;
        return objectTypes.get(entry.templateId)?.name;
      },
    });
  }

  return new GraphQLObjectType({
    name: "Mutation",
    fields: () => ({
      // -------------------------------------------------------------------
      // createEntry
      // -------------------------------------------------------------------
      createEntry: {
        type: entryReturnType,
        args: {
          catalogId: { type: new GraphQLNonNull(GraphQLID) },
          templateId: { type: new GraphQLNonNull(GraphQLID) },
          fields: {
            type: new GraphQLNonNull(
              new GraphQLList(new GraphQLNonNull(FieldInputType)),
            ),
          },
        },
        resolve: async (
          _parent,
          args: { catalogId: string; templateId: string; fields: FieldInput[] },
          context: GraphQLContext,
        ) => {
          assertCanMutate(context);

          const fieldValues = await resolveFields(
            args.fields,
            args.templateId,
            slugMap,
            args.catalogId,
            context.db,
          );

          let entry: entryService.CatalogEntry;
          try {
            entry = await entryService.createEntry({
              catalogId: args.catalogId,
              templateId: args.templateId,
              fieldValues,
            });
          } catch (err: unknown) {
            const code =
              (err as { code?: string }).code ?? "INTERNAL_ERROR";
            const message =
              (err as { message?: string }).message ?? "Failed to create entry";
            throw new GraphQLError(message, { extensions: { code } });
          }

          return formatEntryAsResolvedEntry(entry);
        },
      },

      // -------------------------------------------------------------------
      // updateEntry
      // -------------------------------------------------------------------
      updateEntry: {
        type: entryReturnType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          catalogId: { type: new GraphQLNonNull(GraphQLID) },
          fields: {
            type: new GraphQLNonNull(
              new GraphQLList(new GraphQLNonNull(FieldInputType)),
            ),
          },
        },
        resolve: async (
          _parent,
          args: { id: string; catalogId: string; fields: FieldInput[] },
          context: GraphQLContext,
        ) => {
          assertCanMutate(context);

          // Determine templateId for the entry being updated (needed for slug resolution)
          const [entryRow] = await context.db
            .select({ templateId: catalogEntriesTable.templateId })
            .from(catalogEntriesTable)
            .where(eq(catalogEntriesTable.id, args.id))
            .limit(1);

          if (!entryRow) {
            throw new GraphQLError(`Entry "${args.id}" not found`, {
              extensions: { code: "NOT_FOUND" },
            });
          }

          const fieldValues = await resolveFields(
            args.fields,
            entryRow.templateId,
            slugMap,
            args.catalogId,
            context.db,
          );

          let entry: entryService.CatalogEntry;
          try {
            entry = await entryService.updateEntry(args.id, { fieldValues });
          } catch (err: unknown) {
            const code =
              (err as { code?: string }).code ?? "INTERNAL_ERROR";
            const message =
              (err as { message?: string }).message ?? "Failed to update entry";
            throw new GraphQLError(message, { extensions: { code } });
          }

          return formatEntryAsResolvedEntry(entry);
        },
      },

      // -------------------------------------------------------------------
      // deleteEntry
      // -------------------------------------------------------------------
      deleteEntry: {
        type: GraphQLBoolean,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
          catalogId: { type: new GraphQLNonNull(GraphQLID) },
        },
        resolve: async (
          _parent,
          args: { id: string; catalogId: string },
          context: GraphQLContext,
        ) => {
          assertCanMutate(context);
          void args.catalogId;
          try {
            await entryService.deleteEntry(args.id);
            return true;
          } catch (err: unknown) {
            const code =
              (err as { code?: string }).code ?? "INTERNAL_ERROR";
            const message =
              (err as { message?: string }).message ?? "Failed to delete entry";
            throw new GraphQLError(message, { extensions: { code } });
          }
        },
      },

      // -------------------------------------------------------------------
      // linkEntries
      // -------------------------------------------------------------------
      linkEntries: {
        type: LinkResultType,
        args: {
          catalogId: { type: new GraphQLNonNull(GraphQLID) },
          fromEntryId: { type: new GraphQLNonNull(GraphQLID) },
          toEntryId: { type: new GraphQLNonNull(GraphQLID) },
          relationshipId: { type: new GraphQLNonNull(GraphQLID) },
        },
        resolve: async (
          _parent,
          args: {
            catalogId: string;
            fromEntryId: string;
            toEntryId: string;
            relationshipId: string;
          },
          context: GraphQLContext,
        ) => {
          assertCanMutate(context);
          void args.catalogId;
          try {
            const link = await entryService.linkEntries({
              fromEntryId: args.fromEntryId,
              toEntryId: args.toEntryId,
              relationshipId: args.relationshipId,
            });
            return {
              id: link.id,
              fromEntryId: link.fromEntryId,
              toEntryId: link.toEntryId,
              relationshipId: link.relationshipId,
            };
          } catch (err: unknown) {
            const code =
              (err as { code?: string }).code ?? "INTERNAL_ERROR";
            const message =
              (err as { message?: string }).message ?? "Failed to link entries";
            throw new GraphQLError(message, { extensions: { code } });
          }
        },
      },

      // -------------------------------------------------------------------
      // unlinkEntries
      // -------------------------------------------------------------------
      unlinkEntries: {
        type: GraphQLBoolean,
        args: {
          catalogId: { type: new GraphQLNonNull(GraphQLID) },
          linkId: { type: new GraphQLNonNull(GraphQLID) },
        },
        resolve: async (
          _parent,
          args: { catalogId: string; linkId: string },
          context: GraphQLContext,
        ) => {
          assertCanMutate(context);
          void args.catalogId;
          try {
            await entryService.unlinkEntries(args.linkId);
            return true;
          } catch (err: unknown) {
            const code =
              (err as { code?: string }).code ?? "INTERNAL_ERROR";
            const message =
              (err as { message?: string }).message ?? "Failed to unlink entries";
            throw new GraphQLError(message, { extensions: { code } });
          }
        },
      },
    }),
  });
}
