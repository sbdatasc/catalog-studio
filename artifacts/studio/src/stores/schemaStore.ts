import { create } from "zustand";
import { apiClient, type CatalogTemplate, type ApiError } from "@/lib/apiClient";

export interface SchemaStore {
  templates: CatalogTemplate[];
  templatesLoading: boolean;
  templatesError: ApiError | null;
  fetchTemplates: () => Promise<void>;
  addTemplate: (t: CatalogTemplate) => void;
  updateTemplate: (t: CatalogTemplate) => void;
  removeTemplate: (id: string) => void;
}

export const useSchemaStore = create<SchemaStore>((set) => ({
  templates: [],
  templatesLoading: true,
  templatesError: null,

  fetchTemplates: async () => {
    set({ templatesLoading: true, templatesError: null });
    const { data, error } = await apiClient.schema.listTemplates();
    if (error) {
      set({ templatesError: error, templatesLoading: false });
    } else if (data) {
      set({ templates: data, templatesLoading: false });
    }
  },

  addTemplate: (t: CatalogTemplate) => {
    set((state) => ({
      templates: [...state.templates, t].sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  updateTemplate: (t: CatalogTemplate) => {
    set((state) => ({
      templates: state.templates
        .map((x) => (x.id === t.id ? t : x))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
  },

  removeTemplate: (id: string) => {
    set((state) => ({
      templates: state.templates.filter((t) => t.id !== id),
    }));
  },
}));
