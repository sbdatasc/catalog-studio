import { create } from "zustand";
import { type ReferenceDataset, apiClient } from "@/lib/apiClient";

interface ReferenceDataStore {
  datasets: ReferenceDataset[];
  datasetsLoading: boolean;
  datasetsError: string | null;

  fetchDatasets: () => Promise<void>;
  addDataset: (dataset: ReferenceDataset) => void;
  updateDataset: (dataset: ReferenceDataset) => void;
  removeDataset: (id: string) => void;
}

export const useReferenceDataStore = create<ReferenceDataStore>((set) => ({
  datasets: [],
  datasetsLoading: false,
  datasetsError: null,

  fetchDatasets: async () => {
    set({ datasetsLoading: true, datasetsError: null });
    const { data, error } = await apiClient.referenceData.listDatasets();
    if (error) {
      set({ datasetsLoading: false, datasetsError: error.message });
    } else {
      set({ datasets: data ?? [], datasetsLoading: false });
    }
  },

  addDataset: (dataset) =>
    set((state) => ({
      datasets: [...state.datasets, dataset].sort((a, b) => a.name.localeCompare(b.name)),
    })),

  updateDataset: (dataset) =>
    set((state) => ({
      datasets: state.datasets
        .map((d) => (d.id === dataset.id ? dataset : d))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })),

  removeDataset: (id) =>
    set((state) => ({
      datasets: state.datasets.filter((d) => d.id !== id),
    })),
}));
