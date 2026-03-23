import { create } from "zustand";
import {
  apiClient,
  type CatalogTemplate,
  type Section,
  type AttributeDefinition,
  type RelationshipDefinition,
  type NodePosition,
  type SchemaSnapshot,
  type ApiError,
} from "@/lib/apiClient";

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

  // Sections (D-02) — keyed by templateId
  sectionsByTemplate: Record<string, Section[]>;
  sectionsLoading: Record<string, boolean>;
  fetchSections: (templateId: string) => Promise<void>;
  addSection: (templateId: string, s: Section) => void;
  updateSection: (s: Section) => void;
  removeSection: (templateId: string, sectionId: string) => void;
  reorderSectionsLocal: (templateId: string, orderedIds: string[]) => void;

  // Attributes (D-02) — keyed by sectionId
  attributesBySection: Record<string, AttributeDefinition[]>;
  attributesLoading: Record<string, boolean>;
  fetchAttributes: (sectionId: string) => Promise<void>;
  addAttribute: (sectionId: string, a: AttributeDefinition) => void;
  updateAttribute: (a: AttributeDefinition) => void;
  removeAttribute: (sectionId: string, attrId: string) => void;
  reorderAttributesLocal: (sectionId: string, orderedIds: string[]) => void;

  // Relationships (D-03) — keyed by catalogId
  relationshipsByCatalog: Record<string, RelationshipDefinition[]>;
  relationshipsLoading: Record<string, boolean>;
  relationshipsError: Record<string, ApiError | null>;
  fetchRelationships: (catalogId: string) => Promise<void>;
  addRelationship: (catalogId: string, r: RelationshipDefinition) => void;
  updateRelationshipLocal: (r: RelationshipDefinition) => void;
  removeRelationship: (catalogId: string, relId: string) => void;

  // Node positions (D-03) — keyed by catalogId
  nodePositionsByCatalog: Record<string, NodePosition[]>;
  nodePositionsLoading: Record<string, boolean>;
  fetchNodePositions: (catalogId: string) => Promise<void>;
  updateNodePositionsLocal: (catalogId: string, positions: NodePosition[]) => void;

  // Published schema snapshot (O-01) — keyed by catalogId
  publishedSchemasByCatalog: Record<string, SchemaSnapshot | null>;
  publishedVersionIdByCatalog: Record<string, string | null>;
  publishedSchemaLoading: Record<string, boolean>;
  publishedSchemaError: Record<string, ApiError | null>;
  fetchPublishedSchema: (catalogId: string) => Promise<void>;

  reset: () => void;
}

const sortByName = (a: CatalogTemplate, b: CatalogTemplate) => a.name.localeCompare(b.name);

const initialState = {
  templates: [] as CatalogTemplate[],
  templatesLoading: true,
  templatesError: null as ApiError | null,
  referenceDataTemplates: [] as CatalogTemplate[],
  referenceDataLoading: true,
  referenceDataError: null as ApiError | null,
  sectionsByTemplate: {} as Record<string, Section[]>,
  sectionsLoading: {} as Record<string, boolean>,
  attributesBySection: {} as Record<string, AttributeDefinition[]>,
  attributesLoading: {} as Record<string, boolean>,
  relationshipsByCatalog: {} as Record<string, RelationshipDefinition[]>,
  relationshipsLoading: {} as Record<string, boolean>,
  relationshipsError: {} as Record<string, ApiError | null>,
  nodePositionsByCatalog: {} as Record<string, NodePosition[]>,
  nodePositionsLoading: {} as Record<string, boolean>,
  publishedSchemasByCatalog: {} as Record<string, SchemaSnapshot | null>,
  publishedVersionIdByCatalog: {} as Record<string, string | null>,
  publishedSchemaLoading: {} as Record<string, boolean>,
  publishedSchemaError: {} as Record<string, ApiError | null>,
};

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  ...initialState,

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

  // -------------------------------------------------------------------------
  // Sections
  // -------------------------------------------------------------------------

  fetchSections: async (templateId: string) => {
    set((s) => ({ sectionsLoading: { ...s.sectionsLoading, [templateId]: true } }));
    const { data, error } = await apiClient.schema.listSections(templateId);
    if (error) {
      set((s) => ({ sectionsLoading: { ...s.sectionsLoading, [templateId]: false } }));
    } else if (data) {
      set((s) => ({
        sectionsByTemplate: { ...s.sectionsByTemplate, [templateId]: data },
        sectionsLoading: { ...s.sectionsLoading, [templateId]: false },
      }));
    }
  },

  addSection: (templateId, s) =>
    set((state) => ({
      sectionsByTemplate: {
        ...state.sectionsByTemplate,
        [templateId]: [...(state.sectionsByTemplate[templateId] ?? []), s],
      },
    })),

  updateSection: (s) =>
    set((state) => {
      const sections = state.sectionsByTemplate[s.templateId];
      if (!sections) return state;
      return {
        sectionsByTemplate: {
          ...state.sectionsByTemplate,
          [s.templateId]: sections.map((x) => (x.id === s.id ? s : x)),
        },
      };
    }),

  removeSection: (templateId, sectionId) =>
    set((state) => ({
      sectionsByTemplate: {
        ...state.sectionsByTemplate,
        [templateId]: (state.sectionsByTemplate[templateId] ?? []).filter((s) => s.id !== sectionId),
      },
    })),

  reorderSectionsLocal: (templateId, orderedIds) =>
    set((state) => {
      const sections = state.sectionsByTemplate[templateId];
      if (!sections) return state;
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      const reordered = [...sections].sort(
        (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
      );
      return {
        sectionsByTemplate: {
          ...state.sectionsByTemplate,
          [templateId]: reordered,
        },
      };
    }),

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  fetchAttributes: async (sectionId: string) => {
    set((s) => ({ attributesLoading: { ...s.attributesLoading, [sectionId]: true } }));
    const { data, error } = await apiClient.schema.listAttributes(sectionId);
    if (error) {
      set((s) => ({ attributesLoading: { ...s.attributesLoading, [sectionId]: false } }));
    } else if (data) {
      set((s) => ({
        attributesBySection: { ...s.attributesBySection, [sectionId]: data },
        attributesLoading: { ...s.attributesLoading, [sectionId]: false },
      }));
    }
  },

  addAttribute: (sectionId, a) =>
    set((state) => ({
      attributesBySection: {
        ...state.attributesBySection,
        [sectionId]: [...(state.attributesBySection[sectionId] ?? []), a],
      },
    })),

  updateAttribute: (a) =>
    set((state) => {
      const attrs = state.attributesBySection[a.sectionId];
      if (!attrs) return state;
      return {
        attributesBySection: {
          ...state.attributesBySection,
          [a.sectionId]: attrs.map((x) => (x.id === a.id ? a : x)),
        },
      };
    }),

  removeAttribute: (sectionId, attrId) =>
    set((state) => ({
      attributesBySection: {
        ...state.attributesBySection,
        [sectionId]: (state.attributesBySection[sectionId] ?? []).filter((a) => a.id !== attrId),
      },
    })),

  reorderAttributesLocal: (sectionId, orderedIds) =>
    set((state) => {
      const attrs = state.attributesBySection[sectionId];
      if (!attrs) return state;
      const indexMap = new Map(orderedIds.map((id, i) => [id, i]));
      const reordered = [...attrs].sort(
        (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0),
      );
      return {
        attributesBySection: {
          ...state.attributesBySection,
          [sectionId]: reordered,
        },
      };
    }),

  // -------------------------------------------------------------------------
  // Relationships (D-03)
  // -------------------------------------------------------------------------

  fetchRelationships: async (catalogId: string) => {
    set((s) => ({
      relationshipsLoading: { ...s.relationshipsLoading, [catalogId]: true },
      relationshipsError: { ...s.relationshipsError, [catalogId]: null },
    }));
    const { data, error } = await apiClient.schema.listRelationships(catalogId);
    if (error) {
      set((s) => ({
        relationshipsLoading: { ...s.relationshipsLoading, [catalogId]: false },
        relationshipsError: { ...s.relationshipsError, [catalogId]: error },
      }));
    } else if (data) {
      set((s) => ({
        relationshipsByCatalog: { ...s.relationshipsByCatalog, [catalogId]: data },
        relationshipsLoading: { ...s.relationshipsLoading, [catalogId]: false },
      }));
    }
  },

  addRelationship: (catalogId, r) =>
    set((state) => ({
      relationshipsByCatalog: {
        ...state.relationshipsByCatalog,
        [catalogId]: [...(state.relationshipsByCatalog[catalogId] ?? []), r],
      },
    })),

  updateRelationshipLocal: (r) =>
    set((state) => {
      const rels = state.relationshipsByCatalog[r.catalogId];
      if (!rels) return state;
      return {
        relationshipsByCatalog: {
          ...state.relationshipsByCatalog,
          [r.catalogId]: rels.map((x) => (x.id === r.id ? r : x)),
        },
      };
    }),

  removeRelationship: (catalogId, relId) =>
    set((state) => ({
      relationshipsByCatalog: {
        ...state.relationshipsByCatalog,
        [catalogId]: (state.relationshipsByCatalog[catalogId] ?? []).filter((r) => r.id !== relId),
      },
    })),

  // -------------------------------------------------------------------------
  // Node positions (D-03)
  // -------------------------------------------------------------------------

  fetchNodePositions: async (catalogId: string) => {
    set((s) => ({ nodePositionsLoading: { ...s.nodePositionsLoading, [catalogId]: true } }));
    const { data } = await apiClient.schema.getNodePositions(catalogId);
    if (data) {
      set((s) => ({
        nodePositionsByCatalog: { ...s.nodePositionsByCatalog, [catalogId]: data },
        nodePositionsLoading: { ...s.nodePositionsLoading, [catalogId]: false },
      }));
    } else {
      set((s) => ({ nodePositionsLoading: { ...s.nodePositionsLoading, [catalogId]: false } }));
    }
  },

  updateNodePositionsLocal: (catalogId, positions) =>
    set((state) => ({
      nodePositionsByCatalog: {
        ...state.nodePositionsByCatalog,
        [catalogId]: positions,
      },
    })),

  // -------------------------------------------------------------------------
  // Published schema snapshot (O-01)
  // -------------------------------------------------------------------------

  fetchPublishedSchema: async (catalogId: string) => {
    set((s) => ({
      publishedSchemaLoading: { ...s.publishedSchemaLoading, [catalogId]: true },
      publishedSchemaError: { ...s.publishedSchemaError, [catalogId]: null },
    }));
    const { data, error } = await apiClient.schema.getCurrentVersion(catalogId);
    if (error) {
      set((s) => ({
        publishedSchemaLoading: { ...s.publishedSchemaLoading, [catalogId]: false },
        publishedSchemaError: { ...s.publishedSchemaError, [catalogId]: error },
        publishedSchemasByCatalog: { ...s.publishedSchemasByCatalog, [catalogId]: null },
      }));
      return;
    }
    set((s) => ({
      publishedSchemaLoading: { ...s.publishedSchemaLoading, [catalogId]: false },
      publishedSchemasByCatalog: {
        ...s.publishedSchemasByCatalog,
        [catalogId]: data?.snapshot ?? null,
      },
      publishedVersionIdByCatalog: {
        ...s.publishedVersionIdByCatalog,
        [catalogId]: data?.id ?? null,
      },
    }));
  },

  reset: () => set(initialState),
}));
