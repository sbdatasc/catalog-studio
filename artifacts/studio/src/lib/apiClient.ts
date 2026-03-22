export interface CatalogTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  sectionCount: number;
  attributeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceDataset {
  id: string;
  name: string;
  description: string | null;
  valueCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceValue {
  id: string;
  datasetId: string;
  label: string;
  value: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface ReferenceDatasetWithValues extends ReferenceDataset {
  values: ReferenceValue[];
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
  schema: {
    listTemplates: () =>
      fetchApi<CatalogTemplate[]>("/schema/templates", { method: "GET" }),
    createTemplate: (body: { name: string; description?: string | null }) =>
      fetchApi<CatalogTemplate>("/schema/templates", { method: "POST", body: JSON.stringify(body) }),
    updateTemplate: (id: string, body: { name?: string; description?: string | null }) =>
      fetchApi<CatalogTemplate>(`/schema/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteTemplate: (id: string) =>
      fetchApi<{ deleted: true }>(`/schema/templates/${id}`, { method: "DELETE" }),
  },

  referenceData: {
    listDatasets: () =>
      fetchApi<ReferenceDataset[]>("/reference-data", { method: "GET" }),
    createDataset: (body: { name: string; description?: string | null }) =>
      fetchApi<ReferenceDataset>("/reference-data", { method: "POST", body: JSON.stringify(body) }),
    getDataset: (id: string) =>
      fetchApi<ReferenceDatasetWithValues>(`/reference-data/${id}`, { method: "GET" }),
    updateDataset: (id: string, body: { name?: string; description?: string | null }) =>
      fetchApi<ReferenceDataset>(`/reference-data/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteDataset: (id: string) =>
      fetchApi<{ deleted: true }>(`/reference-data/${id}`, { method: "DELETE" }),
    listValues: (id: string) =>
      fetchApi<ReferenceValue[]>(`/reference-data/${id}/values`, { method: "GET" }),
    createValue: (id: string, body: { label: string; value?: string; displayOrder?: number }) =>
      fetchApi<ReferenceValue>(`/reference-data/${id}/values`, { method: "POST", body: JSON.stringify(body) }),
    updateValue: (id: string, valueId: string, body: { label?: string; value?: string; isActive?: boolean; displayOrder?: number }) =>
      fetchApi<ReferenceValue>(`/reference-data/${id}/values/${valueId}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteValue: (id: string, valueId: string) =>
      fetchApi<{ deleted: true }>(`/reference-data/${id}/values/${valueId}`, { method: "DELETE" }),
    reorderValues: (id: string, orderedIds: string[]) =>
      fetchApi<{ reordered: true }>(`/reference-data/${id}/values/reorder`, { method: "POST", body: JSON.stringify({ orderedIds }) }),
  },
};
