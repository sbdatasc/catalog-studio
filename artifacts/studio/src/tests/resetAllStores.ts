import { useCatalogStore } from "@/stores/catalogStore";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { usePublishStore } from "@/stores/publishStore";
import { useEntryStore } from "@/stores/entryStore";
import { useAuthStore } from "@/stores/authStore";
import { useAdminStore } from "@/stores/adminStore";

export function resetAllStores(): void {
  useCatalogStore.getState().reset();
  useUiStore.getState().reset();
  useSchemaStore.getState().reset();
  usePublishStore.getState().reset();
  useEntryStore.getState().reset();
  useAuthStore.getState().reset();
  useAdminStore.getState().reset();
}
