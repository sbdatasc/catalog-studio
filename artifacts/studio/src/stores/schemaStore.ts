import { create } from "zustand";
import { apiClient, type CatalogTemplate, type ApiError } from "@/lib/apiClient";

export interface SchemaStore {
  // Regular templates (isReferenceData=false)
  templates: CatalogTemplate[];
  templatesLoading: boolean;
  templatesError: ApiError | null;
  fetchTemplates: (catalogId: string) => Promise<void>;
  addTemplate: (t: CatalogTemplate) => void;
  updateTemplate: (t: CatalogTemplate) => void;
  removeTemplate: (id: string) => void;

  // Reference data templates (isReferenceData=true)
  referenceDataTemplates: CatalogTemplate[];
  referenceDataLoading: boolean;
  referenceDataError: ApiError | null;
  fetchReferenceDataTemplates: (catalogId: string) => Promise<void>;
  addReferenceDataTemplate: (t: CatalogTemplate) => void;
  updateReferenceDataTemplate: (t: CatalogTemplate) => void;
  removeReferenceDataTemplate: (id: string) => void;
}

const sortByName = (a: CatalogTemplate, b: CatalogTemplate) => a.name.localeCompare(b.name);

export const useSchemaStore = create<SchemaStore>((set) => ({
  templates: [],
  templatesLoading: true,
  templatesError: null,

  fetchTemplates: async (catalogId: string) => {
    set({ templatesLoading: true, templatesError: null });
    const { data, error } = await apiClient.schema.listTemplates(catalogId, false);
    if (error) {
      set({ templatesError: error, templatesLoading: false });
    } else if (data) {
      set({ templates: data, templatesLoading: false });
    }
  },

  addTemplate: (t) =>
    set((state) => ({ templates: [...state.templates, t].sort(sortByName) })),

  updateTemplate: (t) =>
    set((state) => ({
      templates: state.templates.map((x) => (x.id === t.id ? t : x)).sort(sortByName),
    })),

  removeTemplate: (id) =>
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),

  referenceDataTemplates: [],
  referenceDataLoading: true,
  referenceDataError: null,

  fetchReferenceDataTemplates: async (catalogId: string) => {
    set({ referenceDataLoading: true, referenceDataError: null });
    const { data, error } = await apiClient.schema.listTemplates(catalogId, true);
    if (error) {
      set({ referenceDataError: error, referenceDataLoading: false });
    } else if (data) {
      set({ referenceDataTemplates: data, referenceDataLoading: false });
    }
  },

  addReferenceDataTemplate: (t) =>
    set((state) => ({ referenceDataTemplates: [...state.referenceDataTemplates, t].sort(sortByName) })),

  updateReferenceDataTemplate: (t) =>
    set((state) => ({
      referenceDataTemplates: state.referenceDataTemplates.map((x) => (x.id === t.id ? t : x)).sort(sortByName),
    })),

  removeReferenceDataTemplate: (id) =>
    set((state) => ({ referenceDataTemplates: state.referenceDataTemplates.filter((t) => t.id !== id) })),
}));
