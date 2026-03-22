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
};
