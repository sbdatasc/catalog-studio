import { useEffect } from "react";
import { DesignerNav } from "@/components/DesignerNav";
import { EntityTypeManager } from "@/components/EntityTypeManager";
import { ReferenceDataTemplatesManager } from "@/components/ReferenceDataTemplatesManager";
import { useUiStore } from "@/stores/uiStore";
import { apiClient } from "@/lib/apiClient";

interface Props {
  catalogId: string;
  tab: "templates" | "reference-data";
}

export function DesignerPage({ catalogId, tab }: Props) {
  const { setActiveCatalog, clearActiveCatalog } = useUiStore();

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      const { data } = await apiClient.catalogs.get(catalogId);
      if (data && !cancelled) {
        setActiveCatalog(data.id, data.status);
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
      clearActiveCatalog();
    };
  }, [catalogId, setActiveCatalog, clearActiveCatalog]);

  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <DesignerNav catalogId={catalogId} tab={tab} />
      {tab === "templates" ? (
        <EntityTypeManager catalogId={catalogId} />
      ) : (
        <ReferenceDataTemplatesManager catalogId={catalogId} />
      )}
    </div>
  );
}
