import { create } from "zustand";
import type { CatalogStatus } from "@/lib/apiClient";

interface UiStore {
  // Active catalog context (set by DesignerPage on mount)
  activeCatalogId: string | null;
  activeCatalogStatus: CatalogStatus | null;
  setActiveCatalog: (id: string, status: CatalogStatus) => void;
  clearActiveCatalog: () => void;

  // Template drawer (D-01)
  drawerMode: "closed" | "create" | "edit";
  drawerTemplateId: string | null;
  drawerIsDirty: boolean;
  drawerIsReferenceData: boolean;

  // Guard Modal State
  guardAction: (() => void) | null;

  // Actions
  setDrawerIsDirty: (isDirty: boolean) => void;
  openCreateDrawer: (opts?: { isReferenceData?: boolean }) => void;
  openEditDrawer: (id: string) => void;
  requestCloseDrawer: () => void;
  closeDrawer: () => void;

  // Guard Actions
  confirmDiscard: () => void;
  cancelDiscard: () => void;

  // Delete Modal (templates)
  deleteModalTemplateId: string | null;
  openDeleteModal: (id: string) => void;
  closeDeleteModal: () => void;

  // Section drawer (D-02)
  sectionDrawerMode: "closed" | "create" | "edit";
  sectionDrawerTemplateId: string | null;
  sectionDrawerSectionId: string | null;
  sectionDrawerIsDirty: boolean;
  sectionGuardAction: (() => void) | null;
  openCreateSectionDrawer: (templateId: string) => void;
  openEditSectionDrawer: (templateId: string, sectionId: string) => void;
  requestCloseSectionDrawer: () => void;
  closeSectionDrawer: () => void;
  setSectionDrawerDirty: (dirty: boolean) => void;
  confirmSectionDiscard: () => void;
  cancelSectionDiscard: () => void;

  // Relationship drawer (D-03 / D-05)
  relDrawerMode: "closed" | "create" | "edit";
  relDrawerRelationshipId: string | null;
  relDrawerFromTemplateId: string | null;
  relDrawerToTemplateId: string | null;
  relDrawerIsDirty: boolean;
  openCreateRelDrawer: (opts?: { fromTemplateId?: string; toTemplateId?: string }) => void;
  openEditRelDrawer: (relId: string) => void;
  closeRelDrawer: () => void;
  setRelDrawerDirty: (dirty: boolean) => void;

  // Delete relationship modal (D-03)
  deleteRelModalId: string | null;
  openDeleteRelModal: (id: string) => void;
  closeDeleteRelModal: () => void;

  // Operational Mode (O-01)
  activeTemplateTabId: string | null;
  setActiveTemplateTab: (templateId: string) => void;
  isEntryFormOpen: boolean;
  openEntryForm: () => void;
  closeEntryForm: () => void;

  // Entry list view (O-02)
  entryListViewMode: "card" | "table";
  setEntryListViewMode: (mode: "card" | "table") => void;
  isColumnPickerOpen: boolean;
  toggleColumnPicker: () => void;
  closeColumnPicker: () => void;

  // Entry link mode (O-03)
  linkModeActive: boolean;
  linkModeSourceEntryId: string | null;
  startLinkMode: (sourceEntryId: string) => void;
  endLinkMode: () => void;

  relationshipLinkDrawerOpen: boolean;
  relationshipLinkDrawerRelId: string | null;
  openRelationshipLinkDrawer: (relationshipId: string) => void;
  closeRelationshipLinkDrawer: () => void;

  // Multi-select mode (O-05)
  isMultiSelectMode: boolean;
  selectedEntryIds: Set<string>;
  enterMultiSelectMode: () => void;
  exitMultiSelectMode: () => void;
  toggleEntrySelection: (entryId: string) => void;
  selectAllEntries: (entryIds: string[]) => void;
  clearSelection: () => void;
  isBulkLinkDrawerOpen: boolean;
  openBulkLinkDrawer: () => void;
  closeBulkLinkDrawer: () => void;

  reset: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  activeCatalogId: null,
  activeCatalogStatus: null,
  setActiveCatalog: (id, status) => set({ activeCatalogId: id, activeCatalogStatus: status }),
  clearActiveCatalog: () => set({ activeCatalogId: null, activeCatalogStatus: null }),

  drawerMode: "closed",
  drawerTemplateId: null,
  drawerIsDirty: false,
  drawerIsReferenceData: false,
  guardAction: null,

  setDrawerIsDirty: (isDirty) => set({ drawerIsDirty: isDirty }),

  openCreateDrawer: (opts = {}) => {
    const { drawerIsDirty } = get();
    const isRef = opts.isReferenceData ?? false;
    if (drawerIsDirty) {
      set({
        guardAction: () =>
          set({
            drawerMode: "create",
            drawerTemplateId: null,
            drawerIsDirty: false,
            drawerIsReferenceData: isRef,
            guardAction: null,
          }),
      });
    } else {
      set({ drawerMode: "create", drawerTemplateId: null, drawerIsDirty: false, drawerIsReferenceData: isRef });
    }
  },

  openEditDrawer: (id: string) => {
    const { drawerIsDirty, drawerTemplateId } = get();
    if (drawerTemplateId === id) return;

    if (drawerIsDirty) {
      set({
        guardAction: () =>
          set({ drawerMode: "edit", drawerTemplateId: id, drawerIsDirty: false, guardAction: null }),
      });
    } else {
      set({ drawerMode: "edit", drawerTemplateId: id, drawerIsDirty: false });
    }
  },

  requestCloseDrawer: () => {
    const { drawerIsDirty } = get();
    if (drawerIsDirty) {
      set({
        guardAction: () =>
          set({ drawerMode: "closed", drawerTemplateId: null, drawerIsDirty: false, guardAction: null }),
      });
    } else {
      set({ drawerMode: "closed", drawerTemplateId: null, drawerIsDirty: false });
    }
  },

  closeDrawer: () =>
    set({ drawerMode: "closed", drawerTemplateId: null, drawerIsDirty: false, guardAction: null }),

  confirmDiscard: () => {
    const { guardAction } = get();
    if (guardAction) guardAction();
    else set({ drawerMode: "closed", drawerTemplateId: null, drawerIsDirty: false });
    set({ guardAction: null });
  },

  cancelDiscard: () => set({ guardAction: null }),

  deleteModalTemplateId: null,
  openDeleteModal: (id) => set({ deleteModalTemplateId: id }),
  closeDeleteModal: () => set({ deleteModalTemplateId: null }),

  // -------------------------------------------------------------------------
  // Section Drawer (D-02)
  // -------------------------------------------------------------------------

  sectionDrawerMode: "closed",
  sectionDrawerTemplateId: null,
  sectionDrawerSectionId: null,
  sectionDrawerIsDirty: false,
  sectionGuardAction: null,

  openCreateSectionDrawer: (templateId: string) => {
    const { sectionDrawerIsDirty } = get();
    if (sectionDrawerIsDirty) {
      set({
        sectionGuardAction: () =>
          set({
            sectionDrawerMode: "create",
            sectionDrawerTemplateId: templateId,
            sectionDrawerSectionId: null,
            sectionDrawerIsDirty: false,
            sectionGuardAction: null,
          }),
      });
    } else {
      set({
        sectionDrawerMode: "create",
        sectionDrawerTemplateId: templateId,
        sectionDrawerSectionId: null,
        sectionDrawerIsDirty: false,
      });
    }
  },

  openEditSectionDrawer: (templateId: string, sectionId: string) => {
    const { sectionDrawerIsDirty, sectionDrawerSectionId } = get();
    if (sectionDrawerSectionId === sectionId) return;

    if (sectionDrawerIsDirty) {
      set({
        sectionGuardAction: () =>
          set({
            sectionDrawerMode: "edit",
            sectionDrawerTemplateId: templateId,
            sectionDrawerSectionId: sectionId,
            sectionDrawerIsDirty: false,
            sectionGuardAction: null,
          }),
      });
    } else {
      set({
        sectionDrawerMode: "edit",
        sectionDrawerTemplateId: templateId,
        sectionDrawerSectionId: sectionId,
        sectionDrawerIsDirty: false,
      });
    }
  },

  requestCloseSectionDrawer: () => {
    const { sectionDrawerIsDirty } = get();
    if (sectionDrawerIsDirty) {
      set({
        sectionGuardAction: () =>
          set({
            sectionDrawerMode: "closed",
            sectionDrawerTemplateId: null,
            sectionDrawerSectionId: null,
            sectionDrawerIsDirty: false,
            sectionGuardAction: null,
          }),
      });
    } else {
      set({
        sectionDrawerMode: "closed",
        sectionDrawerTemplateId: null,
        sectionDrawerSectionId: null,
        sectionDrawerIsDirty: false,
      });
    }
  },

  closeSectionDrawer: () =>
    set({
      sectionDrawerMode: "closed",
      sectionDrawerTemplateId: null,
      sectionDrawerSectionId: null,
      sectionDrawerIsDirty: false,
      sectionGuardAction: null,
    }),

  setSectionDrawerDirty: (dirty: boolean) => set({ sectionDrawerIsDirty: dirty }),

  confirmSectionDiscard: () => {
    const { sectionGuardAction } = get();
    if (sectionGuardAction) sectionGuardAction();
    else
      set({
        sectionDrawerMode: "closed",
        sectionDrawerTemplateId: null,
        sectionDrawerSectionId: null,
        sectionDrawerIsDirty: false,
      });
    set({ sectionGuardAction: null });
  },

  cancelSectionDiscard: () => set({ sectionGuardAction: null }),

  // -------------------------------------------------------------------------
  // Relationship Drawer (D-03)
  // -------------------------------------------------------------------------

  relDrawerMode: "closed",
  relDrawerRelationshipId: null,
  relDrawerFromTemplateId: null,
  relDrawerToTemplateId: null,
  relDrawerIsDirty: false,

  openCreateRelDrawer: (opts = {}) => {
    set({
      relDrawerMode: "create",
      relDrawerRelationshipId: null,
      relDrawerFromTemplateId: opts.fromTemplateId ?? null,
      relDrawerToTemplateId: opts.toTemplateId ?? null,
      relDrawerIsDirty: false,
    });
  },

  openEditRelDrawer: (relId: string) => {
    const { relDrawerRelationshipId } = get();
    if (relDrawerRelationshipId === relId) return;
    set({
      relDrawerMode: "edit",
      relDrawerRelationshipId: relId,
      relDrawerFromTemplateId: null,
      relDrawerToTemplateId: null,
      relDrawerIsDirty: false,
    });
  },

  closeRelDrawer: () =>
    set({
      relDrawerMode: "closed",
      relDrawerRelationshipId: null,
      relDrawerFromTemplateId: null,
      relDrawerToTemplateId: null,
      relDrawerIsDirty: false,
    }),

  setRelDrawerDirty: (dirty: boolean) => set({ relDrawerIsDirty: dirty }),

  deleteRelModalId: null,
  openDeleteRelModal: (id) => set({ deleteRelModalId: id }),
  closeDeleteRelModal: () => set({ deleteRelModalId: null }),

  // -------------------------------------------------------------------------
  // Operational Mode (O-01)
  // -------------------------------------------------------------------------

  activeTemplateTabId: null,
  setActiveTemplateTab: (templateId) =>
    set({
      activeTemplateTabId: templateId,
      isMultiSelectMode: false,
      selectedEntryIds: new Set(),
      isBulkLinkDrawerOpen: false,
    }),
  isEntryFormOpen: false,
  openEntryForm: () => set({ isEntryFormOpen: true }),
  closeEntryForm: () => set({ isEntryFormOpen: false }),

  // -------------------------------------------------------------------------
  // Entry list view (O-02)
  // -------------------------------------------------------------------------

  entryListViewMode: "card" as "card" | "table",
  setEntryListViewMode: (mode) =>
    set({
      entryListViewMode: mode,
      isColumnPickerOpen: false,
      isMultiSelectMode: false,
      selectedEntryIds: new Set(),
      isBulkLinkDrawerOpen: false,
    }),
  isColumnPickerOpen: false,
  toggleColumnPicker: () => set((s) => ({ isColumnPickerOpen: !s.isColumnPickerOpen })),
  closeColumnPicker: () => set({ isColumnPickerOpen: false }),

  // -------------------------------------------------------------------------
  // Entry link mode (O-03)
  // -------------------------------------------------------------------------

  linkModeActive: false,
  linkModeSourceEntryId: null,
  startLinkMode: (sourceEntryId: string) =>
    set({ linkModeActive: true, linkModeSourceEntryId: sourceEntryId }),
  endLinkMode: () => set({ linkModeActive: false, linkModeSourceEntryId: null }),

  relationshipLinkDrawerOpen: false,
  relationshipLinkDrawerRelId: null,
  openRelationshipLinkDrawer: (relationshipId: string) =>
    set({ relationshipLinkDrawerOpen: true, relationshipLinkDrawerRelId: relationshipId }),
  closeRelationshipLinkDrawer: () =>
    set({ relationshipLinkDrawerOpen: false, relationshipLinkDrawerRelId: null }),

  // -------------------------------------------------------------------------
  // Multi-select mode (O-05)
  // -------------------------------------------------------------------------

  isMultiSelectMode: false,
  selectedEntryIds: new Set<string>(),
  isBulkLinkDrawerOpen: false,

  enterMultiSelectMode: () => set({ isMultiSelectMode: true }),

  exitMultiSelectMode: () =>
    set({ isMultiSelectMode: false, selectedEntryIds: new Set(), isBulkLinkDrawerOpen: false }),

  toggleEntrySelection: (entryId: string) =>
    set((s) => {
      const next = new Set(s.selectedEntryIds);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return { selectedEntryIds: next };
    }),

  selectAllEntries: (entryIds: string[]) =>
    set({ selectedEntryIds: new Set(entryIds) }),

  clearSelection: () => set({ selectedEntryIds: new Set() }),

  openBulkLinkDrawer: () => set({ isBulkLinkDrawerOpen: true }),
  closeBulkLinkDrawer: () => set({ isBulkLinkDrawerOpen: false }),

  reset: () =>
    set({
      activeCatalogId: null,
      activeCatalogStatus: null,
      drawerMode: "closed",
      drawerTemplateId: null,
      drawerIsDirty: false,
      drawerIsReferenceData: false,
      guardAction: null,
      deleteModalTemplateId: null,
      sectionDrawerMode: "closed",
      sectionDrawerTemplateId: null,
      sectionDrawerSectionId: null,
      sectionDrawerIsDirty: false,
      sectionGuardAction: null,
      relDrawerMode: "closed",
      relDrawerRelationshipId: null,
      relDrawerFromTemplateId: null,
      relDrawerToTemplateId: null,
      relDrawerIsDirty: false,
      deleteRelModalId: null,
      activeTemplateTabId: null,
      isEntryFormOpen: false,
      entryListViewMode: "card" as "card" | "table",
      isColumnPickerOpen: false,
      isMultiSelectMode: false,
      selectedEntryIds: new Set<string>(),
      isBulkLinkDrawerOpen: false,
    }),
}));
