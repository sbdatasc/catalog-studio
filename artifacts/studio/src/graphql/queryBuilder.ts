import type { SchemaSnapshot, SnapshotTemplate, SnapshotAttribute } from "@/lib/apiClient";

// ---------------------------------------------------------------------------
// Types — exported so the store and components can use them
// ---------------------------------------------------------------------------

export interface QueryFilter {
  attributeSlug: string;
  operator: string;
  value: string;
}

export interface QueryBuilderState {
  rootTemplateId: string | null;
  selectedFields: Record<string, Set<string>>;  // templateId → Set<attributeSlug>
  expandedRelIds: string[];                      // relationship ids expanded (from root)
  filters: Record<string, QueryFilter[]>;        // templateId → filters
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toGraphQLSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function getAllScalarSlugs(tpl: SnapshotTemplate): string[] {
  const slugs: string[] = [];
  for (const section of tpl.sections) {
    for (const attr of section.attributes) {
      slugs.push(attr.slug);
    }
  }
  return slugs;
}

function getAttrType(tpl: SnapshotTemplate, slug: string): string | undefined {
  for (const section of tpl.sections) {
    for (const attr of section.attributes) {
      if (attr.slug === slug) return attr.attributeType;
    }
  }
  return undefined;
}

function serializeFilterValue(value: string, attrType: string | undefined, operator: string): string {
  if (attrType === "boolean") {
    return value === "true" ? "true" : "false";
  }
  if (attrType === "number" && ["eq", "gt", "gte", "lt", "lte"].includes(operator)) {
    const n = parseFloat(value);
    return isNaN(n) ? "0" : String(n);
  }
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function buildWhereArg(tpl: SnapshotTemplate, filters: QueryFilter[]): string {
  if (!filters || filters.length === 0) return "";
  const parts = filters
    .filter((f) => f.attributeSlug && f.operator && f.value !== "")
    .map((f) => {
      const attrType = getAttrType(tpl, f.attributeSlug);
      const v = serializeFilterValue(f.value, attrType, f.operator);
      return `${f.attributeSlug}: { ${f.operator}: ${v} }`;
    });
  if (parts.length === 0) return "";
  return `{ ${parts.join(", ")} }`;
}

function buildFieldLines(
  tpl: SnapshotTemplate,
  state: QueryBuilderState,
  snapshot: SchemaSnapshot,
  depth: number,
  indent: string,
): string[] {
  const lines: string[] = [];
  const selected = state.selectedFields[tpl.id] ?? new Set<string>();

  // Always include id
  lines.push(`${indent}id`);

  // Scalar fields
  for (const section of tpl.sections) {
    for (const attr of section.attributes) {
      if (attr.slug !== "id" && selected.has(attr.slug)) {
        lines.push(`${indent}${attr.slug}`);
      }
    }
  }

  // Expanded relationships (only at depth 0 — depth 1 nodes cannot expand further)
  if (depth === 0) {
    for (const relId of state.expandedRelIds) {
      const rel = tpl.relationships.find(
        (r) => r.id === relId && r.fromTemplateId === tpl.id,
      );
      if (!rel) continue;
      const targetTpl = snapshot.templates.find((t) => t.id === rel.toTemplateId);
      if (!targetTpl) continue;

      const relFieldName = toGraphQLSlug(rel.label);
      const nestedLines = buildFieldLines(targetTpl, state, snapshot, 1, indent + "  ");
      lines.push(`${indent}${relFieldName} {`);
      lines.push(...nestedLines);
      lines.push(`${indent}}`);
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// generateQuery — Pure function. Zero side effects.
// ---------------------------------------------------------------------------

export function generateQuery(state: QueryBuilderState, snapshot: SchemaSnapshot): string {
  if (!state.rootTemplateId) return "";

  const rootTpl = snapshot.templates.find((t) => t.id === state.rootTemplateId);
  if (!rootTpl) return "";

  const queryName = rootTpl.slug + "s";
  const filters = state.filters[rootTpl.id] ?? [];
  const whereArg = buildWhereArg(rootTpl, filters);

  const innerLines = buildFieldLines(rootTpl, state, snapshot, 0, "    ");

  return [
    "query {",
    `  ${queryName}${whereArg ? `(where: ${whereArg})` : ""} {`,
    ...innerLines,
    "  }",
    "}",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Operator options per attribute type
// ---------------------------------------------------------------------------

export interface OperatorOption {
  value: string;
  label: string;
}

export function getOperatorsForType(attrType: string): OperatorOption[] {
  switch (attrType) {
    case "string":
    case "text":
      return [
        { value: "eq", label: "equals" },
        { value: "contains", label: "contains" },
        { value: "startsWith", label: "starts with" },
        { value: "endsWith", label: "ends with" },
      ];
    case "number":
      return [
        { value: "eq", label: "equals" },
        { value: "gt", label: "greater than" },
        { value: "gte", label: "≥" },
        { value: "lt", label: "less than" },
        { value: "lte", label: "≤" },
      ];
    case "boolean":
      return [{ value: "eq", label: "equals" }];
    case "date":
      return [
        { value: "eq", label: "equals" },
        { value: "before", label: "before" },
        { value: "after", label: "after" },
      ];
    case "enum":
      return [{ value: "eq", label: "equals" }];
    case "reference_data":
    case "reference":
      return [{ value: "eq", label: "equals" }];
    default:
      return [{ value: "eq", label: "equals" }];
  }
}

// ---------------------------------------------------------------------------
// Initialise selectedFields for a template (all scalar slugs selected by default)
// ---------------------------------------------------------------------------

export function initSelectedFields(tpl: SnapshotTemplate): Set<string> {
  return new Set(getAllScalarSlugs(tpl));
}

export function getScalarAttrs(tpl: SnapshotTemplate): SnapshotAttribute[] {
  return tpl.sections.flatMap((s) => s.attributes);
}
