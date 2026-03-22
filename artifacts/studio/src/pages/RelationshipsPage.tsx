import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignerNav } from "@/components/DesignerNav";
import { GraphCanvas } from "@/components/designer/relationships/GraphCanvas";
import { RelationshipDrawer } from "@/components/designer/relationships/RelationshipDrawer";
import { DeleteRelationshipModal } from "@/components/designer/relationships/DeleteRelationshipModal";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { apiClient } from "@/lib/apiClient";

interface Props {
  catalogId: string;
}

export function RelationshipsPage({ catalogId }: Props) {
  const {
    templates,
    templatesLoading,
    referenceDataTemplates,
    fetchTemplates,
    fetchReferenceDataTemplates,
    relationshipsByCatalog,
    relationshipsLoading,
    fetchRelationships,
    nodePositionsByCatalog,
    nodePositionsLoading,
    fetchNodePositions,
  } = useSchemaStore();

  const { activeCatalogStatus, setActiveCatalog, clearActiveCatalog } = useUiStore();

  const [catalogError, setCatalogError] = useState<string | null>(null);

  const isCatalogLocked =
    activeCatalogStatus !== null && activeCatalogStatus !== "draft";

  const relationships = relationshipsByCatalog[catalogId] ?? [];
  const relsLoading = relationshipsLoading[catalogId] ?? true;
  const positions = nodePositionsByCatalog[catalogId] ?? [];
  const positionsLoading = nodePositionsLoading[catalogId] ?? true;
  const allTemplates = [...templates, ...referenceDataTemplates];

  // Load everything on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: catalogData, error: catalogErr } = await apiClient.catalogs.get(catalogId);
      if (cancelled) return;
      if (catalogErr || !catalogData) {
        setCatalogError("Could not load catalog. Please refresh.");
        return;
      }
      setActiveCatalog(catalogData.id, catalogData.status);

      await Promise.all([
        fetchTemplates(catalogId),
        fetchReferenceDataTemplates(catalogId),
        fetchRelationships(catalogId),
        fetchNodePositions(catalogId),
      ]);
    }

    load();

    return () => {
      cancelled = true;
      clearActiveCatalog();
    };
  }, [catalogId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDataLoading = templatesLoading || relsLoading || positionsLoading;

  return (
    <div className="h-screen flex flex-col w-full bg-background overflow-hidden">
      <DesignerNav catalogId={catalogId} tab="relationships" />

      {/* Locked banner */}
      {isCatalogLocked && (
        <div className="flex items-center gap-3 px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300">
          <Lock className="w-4 h-4 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium">This catalog is locked.</span>{" "}
            Relationship editing is disabled. Duplicate the catalog to make changes.
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700"
            onClick={async () => {
              const { data } = await apiClient.catalogs.duplicate(catalogId);
              if (data) {
                window.location.href = `/catalogs/${data.id}/designer/relationships`;
              }
            }}
          >
            Duplicate Catalog
          </Button>
        </div>
      )}

      {/* Error */}
      {catalogError && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-destructive">{catalogError}</div>
        </div>
      )}

      {/* Loading skeleton */}
      {!catalogError && isDataLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm">Loading relationship graph…</p>
          </div>
        </div>
      )}

      {/* Empty state — no templates */}
      {!catalogError && !isDataLoading && allTemplates.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-foreground">No templates yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create templates first, then come back to define relationships between them.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.history.back()}>
              Go to Templates
            </Button>
          </div>
        </div>
      )}

      {/* Graph canvas */}
      {!catalogError && !isDataLoading && allTemplates.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <GraphCanvas
              catalogId={catalogId}
              templates={allTemplates}
              relationships={relationships}
              savedPositions={positions}
              isLocked={isCatalogLocked}
            />
          </ReactFlowProvider>
        </div>
      )}

      {/* Relationship drawer & delete modal */}
      <RelationshipDrawer catalogId={catalogId} isLocked={isCatalogLocked} />
      <DeleteRelationshipModal catalogId={catalogId} />
    </div>
  );
}
