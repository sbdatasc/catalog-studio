import {
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  GraphQLList,
} from "graphql";

export const StringFilterType = new GraphQLInputObjectType({
  name: "StringFilter",
  fields: {
    eq: { type: GraphQLString },
    contains: { type: GraphQLString },
    startsWith: { type: GraphQLString },
    endsWith: { type: GraphQLString },
  },
});

export const NumberFilterType = new GraphQLInputObjectType({
  name: "NumberFilter",
  fields: {
    eq: { type: GraphQLFloat },
    gt: { type: GraphQLFloat },
    gte: { type: GraphQLFloat },
    lt: { type: GraphQLFloat },
    lte: { type: GraphQLFloat },
  },
});

export const BooleanFilterType = new GraphQLInputObjectType({
  name: "BooleanFilter",
  fields: {
    eq: { type: GraphQLBoolean },
  },
});

export const DateFilterType = new GraphQLInputObjectType({
  name: "DateFilter",
  fields: {
    eq: { type: GraphQLString },
    before: { type: GraphQLString },
    after: { type: GraphQLString },
  },
});

export const IDFilterType = new GraphQLInputObjectType({
  name: "IDFilter",
  fields: {
    eq: { type: GraphQLID },
  },
});

export const EnumFilterType = new GraphQLInputObjectType({
  name: "EnumFilter",
  fields: {
    eq: { type: GraphQLString },
    in: { type: new GraphQLList(GraphQLString) },
  },
});

export type AttributeFilterDef =
  | { type: "StringFilter"; value: { eq?: string; contains?: string; startsWith?: string; endsWith?: string } }
  | { type: "NumberFilter"; value: { eq?: number; gt?: number; gte?: number; lt?: number; lte?: number } }
  | { type: "BooleanFilter"; value: { eq?: boolean } }
  | { type: "DateFilter"; value: { eq?: string; before?: string; after?: string } }
  | { type: "IDFilter"; value: { eq?: string } }
  | { type: "EnumFilter"; value: { eq?: string; in?: string[] } };

export function applyFilterToEntries<
  T extends { id: string; fieldValues: Array<{ attributeId: string; value: string | null }> },
>(
  entries: T[],
  whereArg: Record<string, unknown>,
  attributeSlugToId: Record<string, string>,
  attributeIdToType: Record<string, string>,
): T[] {
  if (!whereArg || typeof whereArg !== "object") return entries;

  let result = entries;

  for (const [attrSlug, filterVal] of Object.entries(whereArg)) {
    if (!filterVal || typeof filterVal !== "object") continue;
    const filter = filterVal as Record<string, unknown>;

    const attributeId = attributeSlugToId[attrSlug];
    if (!attributeId) continue;

    const attrType = attributeIdToType[attributeId];

    result = result.filter((entry) => {
      const fv = entry.fieldValues.find((f) => f.attributeId === attributeId);
      const rawValue = fv?.value ?? null;

      if (attrType === "number") {
        const num = rawValue !== null ? parseFloat(rawValue) : null;
        if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
          if (num !== filter.eq) return false;
        }
        if ("gt" in filter && filter.gt !== undefined && filter.gt !== null) {
          if (num === null || num <= (filter.gt as number)) return false;
        }
        if ("gte" in filter && filter.gte !== undefined && filter.gte !== null) {
          if (num === null || num < (filter.gte as number)) return false;
        }
        if ("lt" in filter && filter.lt !== undefined && filter.lt !== null) {
          if (num === null || num >= (filter.lt as number)) return false;
        }
        if ("lte" in filter && filter.lte !== undefined && filter.lte !== null) {
          if (num === null || num > (filter.lte as number)) return false;
        }
        return true;
      }

      if (attrType === "boolean") {
        if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
          const boolVal = rawValue === "true";
          if (boolVal !== filter.eq) return false;
        }
        return true;
      }

      if (attrType === "date") {
        if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
          if (rawValue !== filter.eq) return false;
        }
        if ("before" in filter && filter.before !== undefined && filter.before !== null) {
          if (rawValue === null || rawValue >= (filter.before as string)) return false;
        }
        if ("after" in filter && filter.after !== undefined && filter.after !== null) {
          if (rawValue === null || rawValue <= (filter.after as string)) return false;
        }
        return true;
      }

      if (attrType === "reference") {
        if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
          if (rawValue !== filter.eq) return false;
        }
        return true;
      }

      if (attrType === "enum") {
        if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
          if (rawValue !== filter.eq) return false;
        }
        if ("in" in filter && Array.isArray(filter.in) && filter.in.length > 0) {
          if (rawValue === null || !(filter.in as string[]).includes(rawValue)) return false;
        }
        return true;
      }

      const strVal = rawValue ?? "";
      const lower = strVal.toLowerCase();

      if ("eq" in filter && filter.eq !== undefined && filter.eq !== null) {
        if (strVal !== filter.eq) return false;
      }
      if ("contains" in filter && filter.contains !== undefined && filter.contains !== null) {
        if (!lower.includes((filter.contains as string).toLowerCase())) return false;
      }
      if ("startsWith" in filter && filter.startsWith !== undefined && filter.startsWith !== null) {
        if (!lower.startsWith((filter.startsWith as string).toLowerCase())) return false;
      }
      if ("endsWith" in filter && filter.endsWith !== undefined && filter.endsWith !== null) {
        if (!lower.endsWith((filter.endsWith as string).toLowerCase())) return false;
      }

      return true;
    });
  }

  return result;
}
