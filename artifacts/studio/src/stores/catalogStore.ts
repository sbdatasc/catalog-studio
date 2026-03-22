import { create } from "zustand";
import { apiClient, type Catalog, type ApiError } from "@/lib/apiClient";

export interface CatalogStore {
  catalogs: Catalog[];
  catalogsLoading: boolean;
  catalogsError: ApiError | null;

  fetchCatalogs: () => Promise<void>;
  addCatalog: (c: Catalog) => void;
  updateCatalog: (c: Catalog) => void;
  removeCatalog: (id: string) => void;
}

export const useCatalogStore = create<CatalogStore>((set) => ({
  catalogs: [],
  catalogsLoading: true,
  catalogsError: null,

  fetchCatalogs: async () => {
    set({ catalogsLoading: true, catalogsError: null });
    const { data, error } = await apiClient.catalogs.list();
    if (error) {
      set({ catalogsError: error, catalogsLoading: false });
    } else if (data) {
      set({ catalogs: data, catalogsLoading: false });
    }
  },

  addCatalog: (c: Catalog) => {
    set((state) => ({
      catalogs: [c, ...state.catalogs],
    }));
  },

  updateCatalog: (c: Catalog) => {
    set((state) => ({
      catalogs: state.catalogs.map((x) => (x.id === c.id ? c : x)),
    }));
  },

  removeCatalog: (id: string) => {
    set((state) => ({
      catalogs: state.catalogs.filter((c) => c.id !== id),
    }));
  },
}));
