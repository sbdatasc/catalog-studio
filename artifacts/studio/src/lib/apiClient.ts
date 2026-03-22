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

export interface ApiError {
  code: string;
  message: string;
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
  },
};
