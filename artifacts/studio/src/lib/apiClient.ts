export type CatalogStatus = "draft" | "pilot" | "published" | "discontinued";

export type AttributeType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "reference"
  | "reference_data";

export interface Catalog {
  id: string;
  name: string;
  description: string | null;
  status: CatalogStatus;
  templateCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogTemplate {
  id: string;
  catalogId: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  isReferenceData: boolean;
  sectionCount: number;
  attributeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Section {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  attributeCount: number;
  createdAt: string;
  updatedAt: string;
}

export type EnumConfig = { options: string[] };
export type ReferenceConfig = { targetTemplateId: string };
export type ReferenceDataConfig = { targetTemplateId: string };
export type AttributeConfig = EnumConfig | ReferenceConfig | ReferenceDataConfig | null;

export interface AttributeDefinition {
  id: string;
  sectionId: string;
  name: string;
  slug: string;
  description: string | null;
  attributeType: AttributeType;
  required: boolean;
  displayOrder: number;
  config: AttributeConfig;
  createdAt: string;
}

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

export interface ChecklistCheck {
  id: string;
  passing: boolean;
  message: string;
  detail?: string;
  navRoute?: string;
}

export interface ChecklistResult {
  allPassing: boolean;
  checks: ChecklistCheck[];
}

export interface SchemaDiff {
  templatesAdded: string[];
  templatesRemoved: string[];
  byTemplate: Record<
    string,
    {
      sectionsAdded: string[];
      sectionsRemoved: string[];
      attributesAdded: Array<{ name: string; type: string }>;
      attributesRemoved: Array<{ name: string; type: string }>;
      attributesModified: Array<{ name: string; field: string; from: string; to: string }>;
    }
  >;
  relationshipsAdded: Array<{ from: string; label: string; to: string; cardinality: string }>;
  relationshipsRemoved: Array<{ from: string; label: string; to: string }>;
}

// ---------------------------------------------------------------------------
// Schema snapshot types (for Operational Mode / O-01)
// ---------------------------------------------------------------------------

export interface SnapshotAttribute {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  attributeType: AttributeType;
  required: boolean;
  displayOrder: number;
  config: AttributeConfig;
}

export interface SnapshotSection {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
  attributes: SnapshotAttribute[];
}

export interface SnapshotRelationship {
  id: string;
  fromTemplateId: string;
  toTemplateId: string;
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
}

export interface SnapshotTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  isReferenceData: boolean;
  sections: SnapshotSection[];
  relationships: SnapshotRelationship[];
}

export interface SchemaSnapshot {
  version: number;
  publishedAt: string;
  catalogId: string;
  catalogName: string;
  templates: SnapshotTemplate[];
}

export interface SchemaVersion {
  id: string;
  catalogId: string;
  versionNumber: number;
  entryCount: number;
  publishedBy: string | null;
  publishedAt: string;
  isCurrent: boolean;
  diff: SchemaDiff | null;
  snapshot: SchemaSnapshot | null;
}

// ---------------------------------------------------------------------------
// Entry types (O-01)
// ---------------------------------------------------------------------------

export interface FieldValue {
  attributeId: string;
  attributeName: string;
  attributeType: AttributeType;
  value: string | null;
  displayValue: string | null;
}

export interface CatalogEntry {
  id: string;
  catalogId: string;
  templateId: string;
  templateName: string;
  schemaVersionId: string;
  displayName: string;
  fieldValues: FieldValue[];
  createdAt: string;
  updatedAt: string;
}

export interface EntryListItem {
  id: string;
  catalogId: string;
  templateId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntryInput {
  catalogId: string;
  templateId: string;
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

export interface UpdateEntryInput {
  fieldValues: Array<{ attributeId: string; value: string | null }>;
}

export interface EntryLinkInstance {
  id: string;
  relationshipId: string;
  relationshipLabel: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
  fromEntryId: string;
  fromEntryName: string;
  fromTemplateId: string;
  toEntryId: string;
  toEntryName: string;
  toTemplateId: string;
  toTemplateName: string;
  createdAt: string;
}

export interface PaginatedEntries {
  entries: EntryListItem[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// API infrastructure
// ---------------------------------------------------------------------------

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

const BASE = "/api";

async function fetchApi<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const json = await res.json();

    if (!res.ok) {
      return {
        data: null,
        error: json.error || { code: "UNKNOWN", message: "Something went wrong. Please try again." },
      };
    }

    return { data: json.data as T, error: null };
  } catch {
    return {
      data: null,
      error: { code: "UNKNOWN", message: "Something went wrong. Please try again." },
    };
  }
}

export const apiClient = {
  catalogs: {
    list: () =>
      fetchApi<Catalog[]>("/catalogs", { method: "GET" }),
    get: (id: string) =>
      fetchApi<Catalog>(`/catalogs/${id}`, { method: "GET" }),
    create: (body: { name: string; description?: string | null }) =>
      fetchApi<Catalog>("/catalogs", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; description?: string | null }) =>
      fetchApi<Catalog>(`/catalogs/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    transition: (id: string, status: string) =>
      fetchApi<Catalog>(`/catalogs/${id}/transition`, { method: "POST", body: JSON.stringify({ status }) }),
    duplicate: (id: string) =>
      fetchApi<Catalog>(`/catalogs/${id}/duplicate`, { method: "POST" }),
  },

  schema: {
    listTemplates: (catalogId: string, isReferenceData?: boolean) => {
      const params = new URLSearchParams({ catalogId });
      if (isReferenceData !== undefined) params.set("isReferenceData", String(isReferenceData));
      return fetchApi<CatalogTemplate[]>(`/schema/templates?${params}`, { method: "GET" });
    },
    getTemplate: (id: string) =>
      fetchApi<CatalogTemplate>(`/schema/templates/${id}`, { method: "GET" }),
    createTemplate: (body: { catalogId: string; name: string; description?: string | null; isReferenceData?: boolean }) =>
      fetchApi<CatalogTemplate>("/schema/templates", { method: "POST", body: JSON.stringify(body) }),
    updateTemplate: (id: string, body: { name?: string; description?: string | null }) =>
      fetchApi<CatalogTemplate>(`/schema/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteTemplate: (id: string) =>
      fetchApi<{ deleted: true }>(`/schema/templates/${id}`, { method: "DELETE" }),

    // Sections
    listSections: (templateId: string) =>
      fetchApi<Section[]>(`/schema/templates/${templateId}/sections`, { method: "GET" }),
    createSection: (templateId: string, body: { name: string; description?: string | null }) =>
      fetchApi<Section>(`/schema/templates/${templateId}/sections`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateSection: (sectionId: string, body: { name?: string; description?: string | null }) =>
      fetchApi<Section>(`/schema/sections/${sectionId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteSection: (sectionId: string) =>
      fetchApi<{ deleted: true }>(`/schema/sections/${sectionId}`, { method: "DELETE" }),
    reorderSections: (templateId: string, orderedIds: string[]) =>
      fetchApi<{ reordered: true }>(`/schema/templates/${templateId}/sections/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      }),

    // Attributes
    listAttributes: (sectionId: string) =>
      fetchApi<AttributeDefinition[]>(`/schema/sections/${sectionId}/attributes`, { method: "GET" }),
    createAttribute: (
      sectionId: string,
      body: {
        name: string;
        attributeType: AttributeType;
        description?: string | null;
        required?: boolean;
        config?: AttributeConfig;
      },
    ) =>
      fetchApi<AttributeDefinition>(`/schema/sections/${sectionId}/attributes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateAttribute: (
      attrId: string,
      body: {
        name?: string;
        description?: string | null;
        required?: boolean;
        config?: AttributeConfig;
      },
    ) =>
      fetchApi<AttributeDefinition>(`/schema/attributes/${attrId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteAttribute: (attrId: string) =>
      fetchApi<{ deleted: true }>(`/schema/attributes/${attrId}`, { method: "DELETE" }),
    reorderAttributes: (sectionId: string, orderedIds: string[]) =>
      fetchApi<{ reordered: true }>(`/schema/sections/${sectionId}/attributes/reorder`, {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      }),

    // Relationships (D-03)
    listRelationships: (catalogId: string) =>
      fetchApi<RelationshipDefinition[]>(`/schema/relationships?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "GET",
      }),
    createRelationship: (body: {
      catalogId: string;
      fromTemplateId: string;
      toTemplateId: string;
      label: string;
      cardinality: "1:1" | "1:N" | "M:N";
      direction: "from" | "to" | "both";
    }) =>
      fetchApi<RelationshipDefinition>("/schema/relationships", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    updateRelationship: (
      id: string,
      body: {
        label?: string;
        cardinality?: "1:1" | "1:N" | "M:N";
        direction?: "from" | "to" | "both";
      },
    ) =>
      fetchApi<RelationshipDefinition>(`/schema/relationships/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    deleteRelationship: (id: string) =>
      fetchApi<{ deleted: true; entryLinkCount: number }>(`/schema/relationships/${id}`, {
        method: "DELETE",
      }),

    // Node positions (D-03)
    getNodePositions: (catalogId: string) =>
      fetchApi<NodePosition[]>(`/schema/relationships/positions?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "GET",
      }),
    saveNodePositions: (catalogId: string, positions: NodePosition[]) =>
      fetchApi<{ ok: true }>(`/schema/relationships/positions?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "POST",
        body: JSON.stringify({ positions }),
      }),

    // Publish (D-04)
    getPublishChecklist: (catalogId: string) =>
      fetchApi<ChecklistResult>(`/schema/publish/checklist?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "GET",
      }),
    getCurrentVersion: (catalogId: string) =>
      fetchApi<SchemaVersion | null>(`/schema/publish/current?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "GET",
      }),
    getVersionHistory: (catalogId: string) =>
      fetchApi<SchemaVersion[]>(`/schema/publish/history?catalogId=${encodeURIComponent(catalogId)}`, {
        method: "GET",
      }),
    getVersionDiff: (versionId: string) =>
      fetchApi<SchemaDiff | null>(`/schema/publish/diff/${encodeURIComponent(versionId)}`, {
        method: "GET",
      }),
    publish: (catalogId: string) =>
      fetchApi<SchemaVersion>("/schema/publish", {
        method: "POST",
        body: JSON.stringify({ catalogId }),
      }),
  },

  // Entry routes (O-01 + O-02)
  entries: {
    list: (catalogId: string, templateId: string, page = 1, limit = 24) =>
      fetchApi<PaginatedEntries>(
        `/entries?catalogId=${encodeURIComponent(catalogId)}&templateId=${encodeURIComponent(templateId)}&page=${page}&limit=${limit}`,
        { method: "GET" },
      ),
    search: (catalogId: string, templateId: string, q: string, limit = 10) =>
      fetchApi<EntryListItem[]>(
        `/entries/search?catalogId=${encodeURIComponent(catalogId)}&templateId=${encodeURIComponent(templateId)}&q=${encodeURIComponent(q)}&limit=${limit}`,
        { method: "GET" },
      ),
    create: (body: CreateEntryInput) =>
      fetchApi<CatalogEntry>("/entries", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    get: (id: string) =>
      fetchApi<CatalogEntry>(`/entries/${encodeURIComponent(id)}`),
    update: (id: string, body: UpdateEntryInput) =>
      fetchApi<CatalogEntry>(`/entries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    delete: (id: string) =>
      fetchApi<{ deleted: true }>(`/entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    getLinks: (entryId: string) =>
      fetchApi<EntryLinkInstance[]>(`/entries/${encodeURIComponent(entryId)}/relationships`),
    link: (entryId: string, body: { relationshipId: string; toEntryId: string }) =>
      fetchApi<EntryLinkInstance>(`/entries/${encodeURIComponent(entryId)}/relationships`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    unlink: (entryId: string, linkId: string) =>
      fetchApi<{ deleted: true }>(
        `/entries/${encodeURIComponent(entryId)}/relationships/${encodeURIComponent(linkId)}`,
        { method: "DELETE" },
      ),
  },

  graphql: (query: string, variables: Record<string, unknown>) =>
    fetchApi<Record<string, unknown>>("/graphql", {
      method: "POST",
      body: JSON.stringify({ query, variables }),
    }),
};
