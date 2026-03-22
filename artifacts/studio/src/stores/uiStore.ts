import { create } from "zustand";

interface UiStore {
  // Drawer
  drawerMode: "closed" | "create" | "edit";
  drawerEntityTypeId: string | null;
  drawerIsDirty: boolean;
  
  // Guard Modal State
  guardAction: (() => void) | null;
  
  // Actions
  setDrawerIsDirty: (isDirty: boolean) => void;
  openCreateDrawer: () => void;
  openEditDrawer: (id: string) => void;
  requestCloseDrawer: () => void; // Checks dirty state
  closeDrawer: () => void;        // Force close
  
  // Guard Actions
  confirmDiscard: () => void;
  cancelDiscard: () => void;

  // Delete Modal
  deleteModalEntityTypeId: string | null;
  openDeleteModal: (id: string) => void;
  closeDeleteModal: () => void;
}

export const useUiStore = create<UiStore>((set, get) => ({
  drawerMode: "closed",
  drawerEntityTypeId: null,
  drawerIsDirty: false,
  guardAction: null,

  setDrawerIsDirty: (isDirty) => set({ drawerIsDirty: isDirty }),

  openCreateDrawer: () => {
    const { drawerIsDirty } = get();
    if (drawerIsDirty) {
      set({ 
        guardAction: () => set({ drawerMode: "create", drawerEntityTypeId: null, drawerIsDirty: false, guardAction: null }) 
      });
    } else {
      set({ drawerMode: "create", drawerEntityTypeId: null, drawerIsDirty: false });
    }
  },

  openEditDrawer: (id: string) => {
    const { drawerIsDirty, drawerEntityTypeId } = get();
    if (drawerEntityTypeId === id) return;
    
    if (drawerIsDirty) {
      set({ 
        guardAction: () => set({ drawerMode: "edit", drawerEntityTypeId: id, drawerIsDirty: false, guardAction: null }) 
      });
    } else {
      set({ drawerMode: "edit", drawerEntityTypeId: id, drawerIsDirty: false });
    }
  },

  requestCloseDrawer: () => {
    const { drawerIsDirty } = get();
    if (drawerIsDirty) {
      set({ 
        guardAction: () => set({ drawerMode: "closed", drawerEntityTypeId: null, drawerIsDirty: false, guardAction: null }) 
      });
    } else {
      set({ drawerMode: "closed", drawerEntityTypeId: null, drawerIsDirty: false });
    }
  },

  closeDrawer: () => set({ drawerMode: "closed", drawerEntityTypeId: null, drawerIsDirty: false, guardAction: null }),

  confirmDiscard: () => {
    const { guardAction } = get();
    if (guardAction) guardAction();
    else set({ drawerMode: "closed", drawerEntityTypeId: null, drawerIsDirty: false });
    set({ guardAction: null });
  },

  cancelDiscard: () => set({ guardAction: null }),

  deleteModalEntityTypeId: null,
  openDeleteModal: (id) => set({ deleteModalEntityTypeId: id }),
  closeDeleteModal: () => set({ deleteModalEntityTypeId: null }),
}));
