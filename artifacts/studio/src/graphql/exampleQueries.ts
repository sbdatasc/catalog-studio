import type { SchemaSnapshot, SnapshotAttribute, SnapshotRelationship, SnapshotTemplate } from "@/lib/apiClient";

export interface ExampleQuery {
  label: string;
  query: string;
}

function toGraphQLSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "_");
}

function capitalize(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function getScalarAttrs(tpl: SnapshotTemplate): SnapshotAttribute[] {
  const attrs: SnapshotAttribute[] = [];
  for (const section of tpl.sections) {
    for (const attr of section.attributes) {
      attrs.push(attr);
    }
  }
  return attrs.slice(0, 3);
}

function getFirstRelationship(tpl: SnapshotTemplate): SnapshotRelationship | null {
  return tpl.relationships[0] ?? null;
}

function scalarFieldLines(attrs: SnapshotAttribute[]): string {
  return ["id", "display_name", ...attrs.map((a) => a.slug)].join("\n    ");
}

function buildListQuery(tpl: SnapshotTemplate, attrs: SnapshotAttribute[]): string {
  const listField = `${tpl.slug}s`;
  const typeName = capitalize(tpl.name);
  return (
    `query List${typeName}s {\n` +
    `  ${listField} {\n` +
    `    ${scalarFieldLines(attrs)}\n` +
    `  }\n` +
    `}`
  );
}

function buildSingleQuery(tpl: SnapshotTemplate, attrs: SnapshotAttribute[]): string {
  const field = tpl.slug;
  const typeName = capitalize(tpl.name);
  return (
    `query Get${typeName}ById($id: ID!) {\n` +
    `  ${field}(id: $id) {\n` +
    `    ${scalarFieldLines(attrs)}\n` +
    `  }\n` +
    `}`
  );
}

function buildTraversalQuery(
  tpl: SnapshotTemplate,
  attrs: SnapshotAttribute[],
  rel: SnapshotRelationship,
): string {
  const listField = `${tpl.slug}s`;
  const relField = toGraphQLSlug(rel.label);
  const typeName = capitalize(tpl.name);
  return (
    `query ${typeName}sWithRelationship {\n` +
    `  ${listField} {\n` +
    `    ${scalarFieldLines(attrs)}\n` +
    `    ${relField} {\n` +
    `      id\n` +
    `      display_name\n` +
    `    }\n` +
    `  }\n` +
    `}`
  );
}

function buildFilterQuery(tpl: SnapshotTemplate, attrs: SnapshotAttribute[]): string {
  const listField = `${tpl.slug}s`;
  const typeName = capitalize(tpl.name);
  const firstText = attrs.find((a) => a.attributeType === "text");
  const filterArg = firstText
    ? `(filter: { ${firstText.slug}: { contains: "example" } })`
    : "";
  return (
    `query Filter${typeName}s {\n` +
    `  ${listField}${filterArg} {\n` +
    `    ${scalarFieldLines(attrs)}\n` +
    `  }\n` +
    `}`
  );
}

export function generateExampleQueries(snapshot: SchemaSnapshot): ExampleQuery[] {
  const templates = snapshot.templates.filter((t) => !t.isReferenceData);
  if (!templates.length) return [];

  const first = templates[0];
  const attrs = getScalarAttrs(first);
  const rel = getFirstRelationship(first);

  const q1: ExampleQuery = {
    label: `List all ${first.name}s`,
    query: buildListQuery(first, attrs),
  };

  const q2: ExampleQuery = {
    label: `Get ${first.name} by ID`,
    query: buildSingleQuery(first, attrs),
  };

  const q3: ExampleQuery = rel
    ? {
        label: `${first.name}s with ${rel.label}`,
        query: buildTraversalQuery(first, attrs, rel),
      }
    : {
        label: `Filter ${first.name}s`,
        query: buildFilterQuery(first, attrs),
      };

  return [q1, q2, q3];
}
