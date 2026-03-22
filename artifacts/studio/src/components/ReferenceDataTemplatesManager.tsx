import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityTypeGrid } from "./EntityTypeGrid";
import { EntityTypeDrawer } from "./EntityTypeForm";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";

interface Props {
  catalogId: string;
}

export function ReferenceDataTemplatesManager({ catalogId }: Props) {
  const {
    fetchReferenceDataTemplates,
    referenceDataTemplates,
    referenceDataLoading,
    referenceDataError,
  } = useSchemaStore();
  const { openCreateDrawer } = useUiStore();

  useEffect(() => {
    fetchReferenceDataTemplates(catalogId);
  }, [catalogId, fetchReferenceDataTemplates]);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Reference Data
            </h1>
            <p className="mt-2 text-muted-foreground text-base">
              Define controlled vocabularies and lookup tables for your catalog.
            </p>
          </div>

          <Button
            onClick={() => openCreateDrawer({ isReferenceData: true })}
            className="shadow-md shadow-primary/10 hover:-translate-y-0.5 transition-transform"
            data-testid="button-new-reference-data-template"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Reference Data
          </Button>
        </div>

        <EntityTypeGrid
          templates={referenceDataTemplates}
          loading={referenceDataLoading}
          error={referenceDataError}
          onRetry={() => fetchReferenceDataTemplates(catalogId)}
          emptyMessage="Reference Data templates define controlled vocabularies and lookup values used across your catalog's metadata."
          onCreateNew={() => openCreateDrawer({ isReferenceData: true })}
        />

      </div>

      <EntityTypeDrawer />
      <DeleteConfirmModal />
      <UnsavedChangesGuard />
    </div>
  );
}
