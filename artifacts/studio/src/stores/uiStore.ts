import { create } from "zustand";

interface UiStore {
  // Drawer
  drawerMode: "closed" | "create" | "edit";
  drawerTemplateId: string | null;
  drawerIsDirty: boolean;

  // Guard Modal State
  guardAction: (() => void) | null;

  // Actions
  setDrawerIsDirty: (isDirty: boolean) => void;
  openCreateDrawer: () => void;
  openEditDrawer: (id: string) => void;
  requestCloseDrawer: () => void;
  closeDrawer: () => void;

  // Guard Actions
  confirmDiscard: () => void;
  cancelDiscard: () => void;

  // Delete Modal
  deleteModalTemplateId: string | null;
  openDeleteModal: (id: string) => void;
  closeDeleteModal: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  drawerMode: "closed",
  drawerTemplateId: null,
  drawerIsDirty: false,
  guardAction: null,

  setDrawerIsDirty: (isDirty) => set({ drawerIsDirty: isDirty }),

  openCreateDrawer: () => {
    const { drawerIsDirty } = get();
    if (drawerIsDirty) {
      set({
        guardAction: () =>
          set({ drawerMode: "create", drawerTemplateId: null, drawerIsDirty: false, guardAction: null }),
      });
    } else {
      set({ drawerMode: "create", drawerTemplateId: null, drawerIsDirty: false });
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
}));
