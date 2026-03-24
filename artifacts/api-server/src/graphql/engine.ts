import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLString,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLEnumValueConfigMap,
} from "graphql";
import type {
  SchemaSnapshot,
  SnapshotTemplate,
  SnapshotAttribute,
  AttributeType,
} from "@workspace/db";
import {
  StringFilterType,
  NumberFilterType,
  BooleanFilterType,
  DateFilterType,
  IDFilterType,
  EnumFilterType,
} from "./filters";
import {
  rootListResolver,
  rootSingleResolver,
  relationshipFieldResolver,
  attributeFieldResolver,
  refDataFieldResolver,
} from "./resolvers";
import { buildMutationRoot } from "./mutations";
import type { DbClient, GraphQLContext, SlugMap } from "./context";
import { getCurrentPublishedSchema } from "../services/templateService";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function toGraphQLSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "_$1");
}

function toPascalCase(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toGraphQLTypeName(name: string): string {
  return toPascalCase(toGraphQLSlug(name));
}

export function buildSlugMap(snapshot: SchemaSnapshot): SlugMap {
  const templateSlugToId: Record<string, string> = {};
  const templateIdToSlug: Record<string, string> = {};
  const attributeSlugToId: Record<string, Record<string, string>> = {};
  const attributeIdToType: Record<string, string> = {};
  const attributeIdToConfig: Record<string, Record<string, unknown>> = {};

  for (const tpl of snapshot.templates) {
    templateSlugToId[tpl.slug] = tpl.id;
    templateIdToSlug[tpl.id] = tpl.slug;
    attributeSlugToId[tpl.id] = {};

    for (const section of tpl.sections) {
      for (const attr of section.attributes) {
        const attrSlug = toGraphQLSlug(attr.name);
        attributeSlugToId[tpl.id][attrSlug] = attr.id;
        attributeIdToType[attr.id] = attr.attributeType;
        attributeIdToConfig[attr.id] = (attr.config as Record<string, unknown>) ?? {};
      }
    }
  }

  return { templateSlugToId, templateIdToSlug, attributeSlugToId, attributeIdToType, attributeIdToConfig };
}

// ---------------------------------------------------------------------------
// Schema building
// ---------------------------------------------------------------------------

function mapAttrToScalarType(attrType: AttributeType) {
  switch (attrType) {
    case "number":
      return GraphQLFloat;
    case "boolean":
      return GraphQLBoolean;
    case "reference":
      return GraphQLID;
    default:
      return GraphQLString;
  }
}

function mapAttrToFilterType(attrType: AttributeType) {
  switch (attrType) {
    case "number":
      return NumberFilterType;
    case "boolean":
      return BooleanFilterType;
    case "date":
      return DateFilterType;
    case "enum":
      return EnumFilterType;
    case "reference":
      return IDFilterType;
    case "reference_data":
      return StringFilterType;
    default:
      return StringFilterType;
  }
}

export function buildSchema(snapshot: SchemaSnapshot): GraphQLSchema {
  const slugMap = buildSlugMap(snapshot);

  const nonRefTemplates = snapshot.templates.filter((t) => !t.isReferenceData);

  const enumTypes = new Map<string, GraphQLEnumType>();
  const objectTypes = new Map<string, GraphQLObjectType>();

  // Step 3 — Build GraphQLEnumType for every enum attribute
  for (const tpl of nonRefTemplates) {
    for (const section of tpl.sections) {
      for (const attr of section.attributes) {
        if (attr.attributeType === "enum") {
          const config = (attr.config as { options?: string[] }) ?? {};
          const options: string[] = config.options ?? [];
          if (options.length === 0) continue;

          const enumTypeName = `${toGraphQLTypeName(tpl.name)}_${toGraphQLTypeName(attr.name)}_Enum`;
          if (!enumTypes.has(attr.id)) {
            const values: GraphQLEnumValueConfigMap = {};
            for (const opt of options) {
              const key = toGraphQLSlug(opt) || `_${opt}`;
              values[key] = { value: opt };
            }
            enumTypes.set(attr.id, new GraphQLEnumType({ name: enumTypeName, values }));
          }
        }
      }
    }
  }

  // Step 4 — Build GraphQLObjectType for every template (both regular and reference data).
  // Non-reference-data templates appear in the QueryRoot; ALL templates appear in the
  // EntryResult union used by mutation return types so createEntry/updateEntry can return
  // the appropriate template-specific type regardless of isReferenceData.
  for (const tpl of snapshot.templates) {
    const typeName = toGraphQLTypeName(tpl.name);
    objectTypes.set(
      tpl.id,
      new GraphQLObjectType({
        name: typeName,
        fields: () => buildObjectFields(tpl, snapshot, enumTypes, objectTypes, slugMap),
      }),
    );
  }

  // Step 5 — Build filter input types for every non-reference-data template
  const filterTypes = new Map<string, GraphQLInputObjectType>();
  for (const tpl of nonRefTemplates) {
    const filterTypeName = `${toGraphQLTypeName(tpl.name)}Filter`;
    const filterFields: GraphQLInputFieldConfigMap = {};

    for (const section of tpl.sections) {
      for (const attr of section.attributes) {
        const attrSlug = toGraphQLSlug(attr.name);
        filterFields[attrSlug] = { type: mapAttrToFilterType(attr.attributeType) };
      }
    }

    filterTypes.set(
      tpl.id,
      new GraphQLInputObjectType({ name: filterTypeName, fields: filterFields }),
    );
  }

  // Step 7 — Build QueryRoot
  const queryFields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {};

  for (const tpl of nonRefTemplates) {
    const objType = objectTypes.get(tpl.id)!;
    const filterType = filterTypes.get(tpl.id);
    const listFieldName = tpl.slug + "s";
    const singleFieldName = tpl.slug;
    const templateId = tpl.id;

    queryFields[listFieldName] = {
      type: new GraphQLList(objType),
      args: filterType ? { where: { type: filterType } } : {},
      resolve: (_parent, args, context) =>
        rootListResolver(templateId, _parent, args as { where?: Record<string, unknown> }, context),
    };

    queryFields[singleFieldName] = {
      type: objType,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_parent, args, context) =>
        rootSingleResolver(_parent, args as { id: string }, context),
    };
  }

  const QueryRoot = new GraphQLObjectType({ name: "Query", fields: queryFields });

  // Step 8 — Mutation root (entry CRUD + links)
  const MutationRoot = buildMutationRoot(snapshot, objectTypes, slugMap);

  return new GraphQLSchema({ query: QueryRoot, mutation: MutationRoot });
}

function buildObjectFields(
  tpl: SnapshotTemplate,
  snapshot: SchemaSnapshot,
  enumTypes: Map<string, GraphQLEnumType>,
  objectTypes: Map<string, GraphQLObjectType>,
  slugMap: SlugMap,
): GraphQLFieldConfigMap<unknown, GraphQLContext> {
  const fields: GraphQLFieldConfigMap<unknown, GraphQLContext> = {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (parent) => (parent as { id: string }).id,
    },
  };

  // Attribute fields
  for (const section of tpl.sections) {
    for (const attr of section.attributes) {
      const attrSlug = toGraphQLSlug(attr.name);
      const attrId = attr.id;
      const attrType = attr.attributeType as AttributeType;

      if (attrType === "reference_data") {
        fields[attrSlug] = {
          type: GraphQLString,
          resolve: (parent, _args, context) =>
            refDataFieldResolver(attrId, parent as never, context),
        };
      } else if (attrType === "enum") {
        const enumType = enumTypes.get(attrId);
        fields[attrSlug] = {
          type: enumType ?? GraphQLString,
          resolve: (parent) => attributeFieldResolver(attrId, attrType, parent as never),
        };
      } else {
        fields[attrSlug] = {
          type: mapAttrToScalarType(attrType),
          resolve: (parent) => attributeFieldResolver(attrId, attrType, parent as never),
        };
      }
    }
  }

  // Step 6 — Relationship fields (from side only)
  for (const rel of tpl.relationships) {
    if (rel.fromTemplateId !== tpl.id) continue;

    const relSlug = toGraphQLSlug(rel.label);
    const targetType = objectTypes.get(rel.toTemplateId);
    if (!targetType) continue;

    const relationshipId = rel.id;
    const isToMany = rel.cardinality !== "1:1";

    const fieldType = isToMany ? new GraphQLList(targetType) : targetType;

    if (fields[relSlug]) continue;

    fields[relSlug] = {
      type: fieldType,
      resolve: (parent, _args, context) =>
        relationshipFieldResolver(relationshipId, "from", parent as never, _args, context),
    };
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Schema cache — keyed by catalogId
// ---------------------------------------------------------------------------

const schemaCache = new Map<string, { versionId: string; schema: GraphQLSchema; snapshot: SchemaSnapshot; slugMap: SlugMap }>();

export async function getOrBuildSchema(
  db: DbClient,
  catalogId: string,
): Promise<{ schema: GraphQLSchema; snapshot: SchemaSnapshot; slugMap: SlugMap }> {
  void db;
  const current = await getCurrentPublishedSchema(catalogId);

  if (!current) {
    throw new SchemaUnreadyError();
  }

  const cached = schemaCache.get(catalogId);
  if (cached?.versionId === current.id) {
    return { schema: cached.schema, snapshot: cached.snapshot, slugMap: cached.slugMap };
  }

  const snapshot = current.snapshot as SchemaSnapshot;
  const schema = buildSchema(snapshot);
  const slugMap = buildSlugMap(snapshot);
  schemaCache.set(catalogId, { versionId: current.id, schema, snapshot, slugMap });
  return { schema, snapshot, slugMap };
}

export class SchemaUnreadyError extends Error {
  readonly code = "GRAPHQL_SCHEMA_UNREADY";
  constructor() {
    super("No schema published yet.");
    this.name = "SchemaUnreadyError";
  }
}
