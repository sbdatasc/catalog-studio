import { create } from "zustand";
import {
  apiClient,
  type EntryListItem,
  type CatalogEntry,
  type ApiError,
  type PaginatedEntries,
} from "@/lib/apiClient";

interface PaginationState {
  page: number;
  total: number;
  hasMore: boolean;
}

interface EntryStore {
  entriesByTemplate: Record<string, EntryListItem[]>;
  entriesLoading: Record<string, boolean>;
  entriesError: Record<string, ApiError | null>;
  paginationByTemplate: Record<string, PaginationState>;

  fetchEntries: (catalogId: string, templateId: string) => Promise<void>;
  loadMoreEntries: (catalogId: string, templateId: string) => Promise<void>;
  addEntry: (templateId: string, entry: CatalogEntry) => void;
  updateEntry: (entry: CatalogEntry) => void;
  removeEntry: (templateId: string, entryId: string) => void;

  activeEntry: CatalogEntry | null;
  activeEntryLoading: boolean;
  activeEntryError: ApiError | null;
  setActiveEntry: (entry: CatalogEntry | null) => void;
  fetchEntry: (id: string) => Promise<void>;

  reset: () => void;
}

const CARD_PAGE_SIZE = 24;
const TABLE_PAGE_SIZE = 50;

const initialState = {
  entriesByTemplate: {} as Record<string, EntryListItem[]>,
  entriesLoading: {} as Record<string, boolean>,
  entriesError: {} as Record<string, ApiError | null>,
  paginationByTemplate: {} as Record<string, PaginationState>,
  activeEntry: null as CatalogEntry | null,
  activeEntryLoading: false,
  activeEntryError: null as ApiError | null,
};

export const useEntryStore = create<EntryStore>((set, get) => ({
  ...initialState,

  fetchEntries: async (catalogId: string, templateId: string) => {
    const key = templateId;
    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: true },
      entriesError: { ...s.entriesError, [key]: null },
    }));

    const result = await apiClient.entries.list(catalogId, templateId, 1, CARD_PAGE_SIZE);

    if (result.error) {
      set((s) => ({
        entriesLoading: { ...s.entriesLoading, [key]: false },
        entriesError: { ...s.entriesError, [key]: result.error },
      }));
      return;
    }

    const paginated = result.data as PaginatedEntries;
    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: false },
      entriesByTemplate: { ...s.entriesByTemplate, [key]: paginated.entries },
      paginationByTemplate: {
        ...s.paginationByTemplate,
        [key]: {
          page: paginated.page,
          total: paginated.total,
          hasMore: paginated.entries.length < paginated.total,
        },
      },
    }));
  },

  loadMoreEntries: async (catalogId: string, templateId: string) => {
    const key = templateId;
    const current = get().paginationByTemplate[key];
    if (!current?.hasMore) return;

    const nextPage = current.page + 1;

    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: true },
    }));

    const result = await apiClient.entries.list(catalogId, templateId, nextPage, CARD_PAGE_SIZE);

    if (result.error) {
      set((s) => ({
        entriesLoading: { ...s.entriesLoading, [key]: false },
      }));
      return;
    }

    const paginated = result.data as PaginatedEntries;
    const existing = get().entriesByTemplate[key] ?? [];

    set((s) => ({
      entriesLoading: { ...s.entriesLoading, [key]: false },
      entriesByTemplate: {
        ...s.entriesByTemplate,
        [key]: [...existing, ...paginated.entries],
      },
      paginationByTemplate: {
        ...s.paginationByTemplate,
        [key]: {
          page: paginated.page,
          total: paginated.total,
          hasMore: existing.length + paginated.entries.length < paginated.total,
        },
      },
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
    set((s) => {
      const existing = s.entriesByTemplate[templateId] ?? [];
      const pagination = s.paginationByTemplate[templateId];
      return {
        entriesByTemplate: {
          ...s.entriesByTemplate,
          [templateId]: [listItem, ...existing],
        },
        paginationByTemplate: pagination
          ? {
              ...s.paginationByTemplate,
              [templateId]: { ...pagination, total: pagination.total + 1 },
            }
          : s.paginationByTemplate,
      };
    });
  },

  updateEntry: (entry: CatalogEntry) => {
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
        [entry.templateId]: (s.entriesByTemplate[entry.templateId] ?? []).map((e) =>
          e.id === entry.id ? listItem : e,
        ),
      },
      activeEntry: s.activeEntry?.id === entry.id ? entry : s.activeEntry,
    }));
  },

  removeEntry: (templateId: string, entryId: string) => {
    set((s) => {
      const pagination = s.paginationByTemplate[templateId];
      return {
        entriesByTemplate: {
          ...s.entriesByTemplate,
          [templateId]: (s.entriesByTemplate[templateId] ?? []).filter((e) => e.id !== entryId),
        },
        paginationByTemplate: pagination
          ? {
              ...s.paginationByTemplate,
              [templateId]: { ...pagination, total: Math.max(0, pagination.total - 1) },
            }
          : s.paginationByTemplate,
        activeEntry: s.activeEntry?.id === entryId ? null : s.activeEntry,
      };
    });
  },

  fetchEntry: async (id: string) => {
    set({ activeEntryLoading: true, activeEntryError: null });
    const result = await apiClient.entries.get(id);
    if (result.error) {
      set({ activeEntryLoading: false, activeEntryError: result.error });
      return;
    }
    set({ activeEntryLoading: false, activeEntry: result.data });
  },

  setActiveEntry: (entry) => set({ activeEntry: entry }),

  reset: () => set(initialState),
}));

export { TABLE_PAGE_SIZE };
