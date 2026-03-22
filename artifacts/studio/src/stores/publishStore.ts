import { create } from "zustand";
import {
  apiClient,
  type ChecklistResult,
  type SchemaVersion,
  type SchemaDiff,
  type ApiError,
} from "@/lib/apiClient";

export interface PublishStore {
  // Checklist
  checklist: ChecklistResult | null;
  checklistLoading: boolean;
  checklistError: ApiError | null;
  fetchChecklist: (catalogId: string) => Promise<void>;

  // Current published version
  currentVersion: SchemaVersion | null;
  currentVersionLoading: boolean;
  fetchCurrentVersion: (catalogId: string) => Promise<void>;

  // Version history
  history: SchemaVersion[];
  historyLoading: boolean;
  historyError: ApiError | null;
  fetchHistory: (catalogId: string) => Promise<void>;

  // Selected version diff
  selectedVersionId: string | null;
  selectedDiff: SchemaDiff | null;
  diffLoading: boolean;
  selectVersion: (versionId: string | null) => void;
  fetchDiff: (versionId: string) => Promise<void>;

  // Publishing
  publishing: boolean;
  publishError: ApiError | null;
  publish: (catalogId: string) => Promise<SchemaVersion | null>;

  // Reset when switching catalogs
  reset: () => void;
}

const initialState = {
  checklist: null,
  checklistLoading: true,
  checklistError: null,
  currentVersion: null,
  currentVersionLoading: true,
  history: [],
  historyLoading: true,
  historyError: null,
  selectedVersionId: null,
  selectedDiff: null,
  diffLoading: false,
  publishing: false,
  publishError: null,
};

export const usePublishStore = create<PublishStore>((set, get) => ({
  ...initialState,

  fetchChecklist: async (catalogId) => {
    set({ checklistLoading: true, checklistError: null });
    const res = await apiClient.schema.getPublishChecklist(catalogId);
    set({
      checklist: res.data ?? null,
      checklistLoading: false,
      checklistError: res.error,
    });
  },

  fetchCurrentVersion: async (catalogId) => {
    set({ currentVersionLoading: true });
    const res = await apiClient.schema.getCurrentVersion(catalogId);
    set({ currentVersion: res.data ?? null, currentVersionLoading: false });
  },

  fetchHistory: async (catalogId) => {
    set({ historyLoading: true, historyError: null });
    const res = await apiClient.schema.getVersionHistory(catalogId);
    set({
      history: res.data ?? [],
      historyLoading: false,
      historyError: res.error,
    });
  },

  selectVersion: (versionId) => {
    set({ selectedVersionId: versionId, selectedDiff: null });
    if (versionId) get().fetchDiff(versionId);
  },

  fetchDiff: async (versionId) => {
    set({ diffLoading: true });
    const res = await apiClient.schema.getVersionDiff(versionId);
    set({ selectedDiff: res.data ?? null, diffLoading: false });
  },

  publish: async (catalogId) => {
    set({ publishing: true, publishError: null });
    const res = await apiClient.schema.publish(catalogId);
    if (res.error) {
      set({ publishing: false, publishError: res.error });
      return null;
    }
    const newVersion = res.data!;
    set((state) => ({
      publishing: false,
      publishError: null,
      currentVersion: newVersion,
      history: [newVersion, ...state.history.map((v) => ({ ...v, isCurrent: false }))],
      checklist: null,
    }));
    return newVersion;
  },

  reset: () => set(initialState),
}));
