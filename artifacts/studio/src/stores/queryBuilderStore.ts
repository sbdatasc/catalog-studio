import { create } from "zustand";
import type { SchemaSnapshot } from "@/lib/apiClient";
import {
  generateQuery,
  initSelectedFields,
  type QueryBuilderState,
  type QueryFilter,
} from "@/graphql/queryBuilder";

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface QueryBuilderStore {
  // Snapshot reference (set by ExplorerTab on load)
  snapshot: SchemaSnapshot | null;
  setSnapshot: (snapshot: SchemaSnapshot | null) => void;

  // Builder state
  state: QueryBuilderState;

  // Derived — updated on every state change
  generatedQuery: string;

  // Execution state
  queryResults: unknown | null;
  isRunning: boolean;
  runError: string | null;

  // Tab + panel state
  activeTab: "explorer" | "graphiql";
  graphiqlQuery: string;
  activePanelTemplateId: string | null;

  // Actions
  setRootTemplate: (templateId: string | null) => void;
  setActivePanelTemplate: (templateId: string | null) => void;
  toggleField: (templateId: string, slug: string) => void;
  selectAllFields: (templateId: string) => void;
  clearAllFields: (templateId: string) => void;
  expandRelationship: (relId: string) => void;
  collapseRelationship: (relId: string) => void;
  addFilter: (templateId: string, filter: QueryFilter) => void;
  removeFilter: (templateId: string, index: number) => void;
  runQuery: (catalogId: string) => Promise<void>;
  setActiveTab: (tab: "explorer" | "graphiql") => void;
  setGraphiQLQuery: (query: string) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialBuilderState: QueryBuilderState = {
  rootTemplateId: null,
  selectedFields: {},
  expandedRelIds: [],
  filters: {},
};

// ---------------------------------------------------------------------------
// Helper: recompute derived generatedQuery
// ---------------------------------------------------------------------------

function recompute(state: QueryBuilderState, snapshot: SchemaSnapshot | null): string {
  if (!snapshot) return "";
  return generateQuery(state, snapshot);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useQueryBuilderStore = create<QueryBuilderStore>((set, get) => ({
  snapshot: null,
  setSnapshot: (snapshot) => {
    set({ snapshot });
    // Recompute query in case snapshot changed
    const { state } = get();
    set({ generatedQuery: recompute(state, snapshot) });
  },

  state: initialBuilderState,
  generatedQuery: "",

  queryResults: null,
  isRunning: false,
  runError: null,

  activeTab: "explorer",
  graphiqlQuery: "",
  activePanelTemplateId: null,

  setRootTemplate: (templateId) => {
    const { snapshot } = get();
    const newState = { ...initialBuilderState };

    if (templateId && snapshot) {
      const tpl = snapshot.templates.find((t) => t.id === templateId);
      if (tpl) {
        newState.rootTemplateId = templateId;
        newState.selectedFields = { [templateId]: initSelectedFields(tpl) };
      }
    }

    set({
      state: newState,
      generatedQuery: recompute(newState, snapshot),
      activePanelTemplateId: templateId,
      queryResults: null,
      runError: null,
    });
  },

  setActivePanelTemplate: (templateId) => set({ activePanelTemplateId: templateId }),

  toggleField: (templateId, slug) => {
    const { state: prev, snapshot } = get();
    const current = prev.selectedFields[templateId] ?? new Set<string>();
    const next = new Set(current);
    if (next.has(slug)) {
      next.delete(slug);
    } else {
      next.add(slug);
    }
    const newState = {
      ...prev,
      selectedFields: { ...prev.selectedFields, [templateId]: next },
    };
    set({ state: newState, generatedQuery: recompute(newState, snapshot) });
  },

  selectAllFields: (templateId) => {
    const { state: prev, snapshot } = get();
    if (!snapshot) return;
    const tpl = snapshot.templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const newState = {
      ...prev,
      selectedFields: { ...prev.selectedFields, [templateId]: initSelectedFields(tpl) },
    };
    set({ state: newState, generatedQuery: recompute(newState, snapshot) });
  },

  clearAllFields: (templateId) => {
    const { state: prev, snapshot } = get();
    const newState = {
      ...prev,
      selectedFields: { ...prev.selectedFields, [templateId]: new Set<string>() },
    };
    set({ state: newState, generatedQuery: recompute(newState, snapshot) });
  },

  expandRelationship: (relId) => {
    const { state: prev, snapshot } = get();
    if (prev.expandedRelIds.includes(relId)) return;
    if (!snapshot) return;

    // Find the target template for this relationship
    const rootTpl = snapshot.templates.find((t) => t.id === prev.rootTemplateId);
    const rel = rootTpl?.relationships.find((r) => r.id === relId);
    const targetTpl = rel ? snapshot.templates.find((t) => t.id === rel.toTemplateId) : null;

    const newSelectedFields = { ...prev.selectedFields };
    if (targetTpl && !newSelectedFields[targetTpl.id]) {
      newSelectedFields[targetTpl.id] = initSelectedFields(targetTpl);
    }

    const newState = {
      ...prev,
      expandedRelIds: [...prev.expandedRelIds, relId],
      selectedFields: newSelectedFields,
    };

    set({
      state: newState,
      generatedQuery: recompute(newState, snapshot),
      activePanelTemplateId: targetTpl?.id ?? prev.rootTemplateId,
    });
  },

  collapseRelationship: (relId) => {
    const { state: prev, snapshot } = get();
    if (!snapshot) return;

    const rootTpl = snapshot.templates.find((t) => t.id === prev.rootTemplateId);
    const rel = rootTpl?.relationships.find((r) => r.id === relId);

    // Remove from expanded list + clean up its fields/filters
    const newSelectedFields = { ...prev.selectedFields };
    const newFilters = { ...prev.filters };
    if (rel) {
      delete newSelectedFields[rel.toTemplateId];
      delete newFilters[rel.toTemplateId];
    }

    const newState = {
      ...prev,
      expandedRelIds: prev.expandedRelIds.filter((id) => id !== relId),
      selectedFields: newSelectedFields,
      filters: newFilters,
    };

    set({
      state: newState,
      generatedQuery: recompute(newState, snapshot),
      activePanelTemplateId: prev.rootTemplateId,
    });
  },

  addFilter: (templateId, filter) => {
    const { state: prev, snapshot } = get();
    const existing = prev.filters[templateId] ?? [];
    const newState = {
      ...prev,
      filters: { ...prev.filters, [templateId]: [...existing, filter] },
    };
    set({ state: newState, generatedQuery: recompute(newState, snapshot) });
  },

  removeFilter: (templateId, index) => {
    const { state: prev, snapshot } = get();
    const existing = prev.filters[templateId] ?? [];
    const newState = {
      ...prev,
      filters: {
        ...prev.filters,
        [templateId]: existing.filter((_, i) => i !== index),
      },
    };
    set({ state: newState, generatedQuery: recompute(newState, snapshot) });
  },

  runQuery: async (catalogId) => {
    const { generatedQuery } = get();
    if (!generatedQuery) return;

    set({ isRunning: true, runError: null, queryResults: null });

    try {
      const { useAuthStore } = await import("@/stores/authStore");
      const token = useAuthStore.getState().accessToken;

      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: generatedQuery,
          variables: { catalogId },
        }),
      });

      const envelope = await res.json();

      if (envelope.error) {
        set({ runError: envelope.error.message ?? "Query failed", isRunning: false });
        return;
      }

      if (envelope.errors && envelope.errors.length > 0) {
        set({ runError: envelope.errors[0].message ?? "Query error", isRunning: false });
        return;
      }

      set({ queryResults: envelope.data, isRunning: false });
    } catch (err) {
      set({ runError: "Network error — could not reach API", isRunning: false });
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setGraphiQLQuery: (query) => set({ graphiqlQuery: query }),

  reset: () =>
    set({
      state: initialBuilderState,
      generatedQuery: "",
      queryResults: null,
      isRunning: false,
      runError: null,
      activePanelTemplateId: null,
    }),
}));
