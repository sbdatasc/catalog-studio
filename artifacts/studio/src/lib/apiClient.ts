export interface EntityType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystemSeed: boolean;
  fieldCount: number;
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
        error: json.error || { code: "UNKNOWN", message: "Something went wrong. Please try again." } 
      };
    }
    
    return { data: json.data as T, error: null };
  } catch (err) {
    return { 
      data: null, 
      error: { code: "UNKNOWN", message: "Something went wrong. Please try again." } 
    };
  }
}

export const apiClient = {
  schema: {
    listEntityTypes: () => fetchApi<EntityType[]>("/schema/entity-types", { method: "GET" }),
    createEntityType: (body: { name: string; description?: string | null }) => 
      fetchApi<EntityType>("/schema/entity-types", { method: "POST", body: JSON.stringify(body) }),
    updateEntityType: (id: string, body: { name?: string; description?: string | null }) => 
      fetchApi<EntityType>(`/schema/entity-types/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteEntityType: (id: string) => 
      fetchApi<{ deleted: true }>(`/schema/entity-types/${id}`, { method: "DELETE" }),
  }
};
