import { create } from "zustand";
import { apiClient, EntityType, ApiError } from "@/lib/apiClient";

export interface SchemaStore {
  entityTypes: EntityType[];
  entityTypesLoading: boolean;
  entityTypesError: ApiError | null;
  fetchEntityTypes: () => Promise<void>;
  addEntityType: (et: EntityType) => void;
  updateEntityType: (et: EntityType) => void;
  removeEntityType: (id: string) => void;
}

export const useSchemaStore = create<SchemaStore>((set) => ({
  entityTypes: [],
  entityTypesLoading: true,
  entityTypesError: null,

  fetchEntityTypes: async () => {
    set({ entityTypesLoading: true, entityTypesError: null });
    const { data, error } = await apiClient.schema.listEntityTypes();
    if (error) {
      set({ entityTypesError: error, entityTypesLoading: false });
    } else if (data) {
      set({ entityTypes: data, entityTypesLoading: false });
    }
  },

  addEntityType: (et: EntityType) => {
    set((state) => ({
      entityTypes: [...state.entityTypes, et].sort((a, b) => a.name.localeCompare(b.name))
    }));
  },

  updateEntityType: (et: EntityType) => {
    set((state) => ({
      entityTypes: state.entityTypes
        .map((t) => (t.id === et.id ? et : t))
        .sort((a, b) => a.name.localeCompare(b.name))
    }));
  },

  removeEntityType: (id: string) => {
    set((state) => ({
      entityTypes: state.entityTypes.filter((t) => t.id !== id)
    }));
  }
}));
