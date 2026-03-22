import { create } from "zustand";
import { apiClient, type EntryListItem, type CatalogEntry, type ApiError } from "@/lib/apiClient";

interface EntryStore {
  entriesByTemplate: Record<string, EntryListItem[]>;
  entriesLoading: Record<string, boolean>;
  entriesError: Record<string, ApiError | null>;

  fetchEntries: (catalogId: string, templateId: string) => Promise<void>;
  addEntry: (templateId: string, entry: CatalogEntry) => void;
  removeEntry: (templateId: string, entryId: string) => void;

  activeEntry: CatalogEntry | null;
  activeEntryLoading: boolean;
  setActiveEntry: (entry: CatalogEntry | null) => void;

  reset: () => void;
}

const initialState = {
  entriesByTemplate: {} as Record<string, EntryListItem[]>,
  entriesLoading: {} as Record<string, boolean>,
  entriesError: {} as Record<string, ApiError | null>,
  activeEntry: null as CatalogEntry | null,
  activeEntryLoading: false,
};

export const useEntryStore = create<EntryStore>((set, get) => ({
  ...initialState,

  fetchEntries: async (catalogId: string, templateId: string) => {
    const key = templateId;
    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: true },
      entriesError: { ...s.entriesError, [key]: null },
    }));
    const result = await apiClient.entries.list(catalogId, templateId);
    if (result.error) {
      set((s) => ({
        entriesLoading: { ...s.entriesLoading, [key]: false },
        entriesError: { ...s.entriesError, [key]: result.error },
      }));
      return;
    }
    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: false },
      entriesByTemplate: { ...s.entriesByTemplate, [key]: result.data ?? [] },
    }));
  },

  addEntry: (templateId: string, entry: CatalogEntry) => {
    const listItem: EntryListItem = {
      id: entry.id,
      catalogId: entry.catalogId,
      templateId: entry.templateId,
      displayName: entry.displayName,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
    set((s) => ({
      entriesByTemplate: {
        ...s.entriesByTemplate,
        [templateId]: [listItem, ...(s.entriesByTemplate[templateId] ?? [])],
      },
    }));
  },

  removeEntry: (templateId: string, entryId: string) => {
    set((s) => ({
      entriesByTemplate: {
        ...s.entriesByTemplate,
        [templateId]: (s.entriesByTemplate[templateId] ?? []).filter((e) => e.id !== entryId),
      },
    }));
  },

  activeEntry: null,
  activeEntryLoading: false,
  setActiveEntry: (entry) => set({ activeEntry: entry }),

  reset: () => set(initialState),
}));
