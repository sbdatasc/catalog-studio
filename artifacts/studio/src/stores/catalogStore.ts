import { create } from "zustand";
import { apiClient, type Catalog, type ApiError, type CatalogRole } from "@/lib/apiClient";

export interface CatalogStore {
  catalogs: Catalog[];
  catalogsLoading: boolean;
  catalogsError: ApiError | null;

  myRoles: Record<string, CatalogRole | "platform_admin">;
  myRolesLoading: boolean;

  fetchCatalogs: () => Promise<void>;
  fetchMyRoles: () => Promise<void>;
  addCatalog: (c: Catalog) => void;
  updateCatalog: (c: Catalog) => void;
  removeCatalog: (id: string) => void;
  reset: () => void;
}

const initialState = {
  catalogs: [] as Catalog[],
  catalogsLoading: true,
  catalogsError: null as ApiError | null,
  myRoles: {} as Record<string, CatalogRole | "platform_admin">,
  myRolesLoading: false,
};

export const useCatalogStore = create<CatalogStore>((set) => ({
  ...initialState,

  fetchCatalogs: async () => {
    set({ catalogsLoading: true, catalogsError: null });
    const { data, error } = await apiClient.catalogs.list();
    if (error) {
      set({ catalogsError: error, catalogsLoading: false });
    } else if (data) {
      set({ catalogs: data, catalogsLoading: false });
    }
  },

  fetchMyRoles: async () => {
    set({ myRolesLoading: true });
    const { data } = await apiClient.catalogRoles.myCatalogs();
    if (data) {
      const roles: Record<string, CatalogRole | "platform_admin"> = {};
      for (const c of data) {
        roles[c.id] = c.catalogRole;
      }
      set({ myRoles: roles, myRolesLoading: false });
    } else {
      set({ myRolesLoading: false });
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

  reset: () => set(initialState),
}));
