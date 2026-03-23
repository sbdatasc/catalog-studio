import type { EntryFilter, FilterOperator } from "@/lib/apiClient";

const VALID_OPERATORS: FilterOperator[] = [
  "eq",
  "contains",
  "startsWith",
  "endsWith",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
  "in",
  "isEmpty",
  "isNotEmpty",
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFiltersFromURL(params: URLSearchParams): EntryFilter[] {
  const filters: EntryFilter[] = [];
  for (const [key, value] of params.entries()) {
    // key format: filter[attrId][operator]
    const m = key.match(/^filter\[([^\]]+)\]\[([^\]]+)\]$/);
    if (!m) continue;
    const [, attributeId, operator] = m;
    if (!UUID_RE.test(attributeId!)) continue;
    if (!VALID_OPERATORS.includes(operator as FilterOperator)) continue;
    filters.push({
      attributeId: attributeId!,
      operator: operator as FilterOperator,
      value: value === "" ? null : value,
    });
  }
  return filters;
}

export function serializeFiltersToURL(
  filters: EntryFilter[],
  existing?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();

  // Copy non-filter params
  if (existing) {
    for (const [key, value] of existing.entries()) {
      if (!key.startsWith("filter[")) {
        next.set(key, value);
      }
    }
  }

  // Serialize filters
  for (const f of filters) {
    const key = `filter[${f.attributeId}][${f.operator}]`;
    const val = f.operator === "isEmpty" || f.operator === "isNotEmpty" ? "" : (f.value ?? "");
    if (val !== "" || f.operator === "isEmpty" || f.operator === "isNotEmpty") {
      next.set(key, val);
    }
  }

  return next;
}

export function filtersToKey(filters: EntryFilter[]): string {
  return filters
    .map((f) => `${f.attributeId}:${f.operator}:${f.value ?? ""}`)
    .sort()
    .join("|");
}
