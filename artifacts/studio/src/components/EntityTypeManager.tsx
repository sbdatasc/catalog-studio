import { useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityTypeGrid } from "./EntityTypeGrid";
import { EntityTypeDrawer } from "./EntityTypeForm";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { UnsavedChangesGuard } from "./UnsavedChangesGuard";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";
import { usePermissions } from "@/hooks/usePermissions";

interface Props {
  catalogId: string;
}

export function EntityTypeManager({ catalogId }: Props) {
  const { fetchTemplates, templates, templatesLoading, templatesError } = useSchemaStore();
  const { openCreateDrawer } = useUiStore();
  const { canEditSchema } = usePermissions(catalogId);

  useEffect(() => {
    fetchTemplates(catalogId);
  }, [catalogId, fetchTemplates]);

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Templates
            </h1>
            <p className="mt-2 text-muted-foreground text-base">
              Define the shape and structure of your catalog's metadata.
            </p>
          </div>

          {canEditSchema && (
            <Button
              onClick={() => openCreateDrawer({ isReferenceData: false })}
              className="shadow-md shadow-primary/10 hover:-translate-y-0.5 transition-transform"
              data-testid="button-new-template"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          )}
        </div>

        <EntityTypeGrid
          templates={templates}
          loading={templatesLoading}
          error={templatesError}
          onRetry={() => fetchTemplates(catalogId)}
          emptyMessage="Templates define the structure of the data assets in your catalog. Get started by creating your first template."
          onCreateNew={canEditSchema ? () => openCreateDrawer({ isReferenceData: false }) : undefined}
        />

      </div>

      <EntityTypeDrawer />
      <DeleteConfirmModal />
      <UnsavedChangesGuard />
    </div>
  );
}
