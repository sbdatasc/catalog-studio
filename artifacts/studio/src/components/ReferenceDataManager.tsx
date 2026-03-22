import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReferenceDataStore } from "@/stores/referenceDataStore";
import { type ReferenceDataset } from "@/lib/apiClient";
import { ReferenceDatasetGrid } from "./ReferenceDatasetGrid";
import { ReferenceDataDrawer } from "./ReferenceDataDrawer";
import { DeleteDatasetModal } from "./DeleteDatasetModal";

export function ReferenceDataManager() {
  const { fetchDatasets, addDataset, updateDataset, removeDataset } = useReferenceDataStore();

  const [drawerMode, setDrawerMode] = useState<"closed" | "create" | "edit">("closed");
  const [editingDataset, setEditingDataset] = useState<ReferenceDataset | null>(null);
  const [deletingDataset, setDeletingDataset] = useState<ReferenceDataset | null>(null);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleOpenCreate = () => {
    setEditingDataset(null);
    setDrawerMode("create");
  };

  const handleOpenEdit = (dataset: ReferenceDataset) => {
    setEditingDataset(dataset);
    setDrawerMode("edit");
  };

  const handleDrawerClose = () => {
    setDrawerMode("closed");
    setEditingDataset(null);
  };

  const handleDrawerSuccess = (dataset: ReferenceDataset) => {
    if (drawerMode === "create") {
      addDataset(dataset);
    } else {
      updateDataset(dataset);
    }
    handleDrawerClose();
  };

  const handleDeleteSuccess = (id: string) => {
    removeDataset(id);
    setDeletingDataset(null);
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-10 space-y-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
              Reference Data
            </h1>
            <p className="mt-2 text-muted-foreground text-base">
              Manage controlled vocabulary lists used as dropdown options in templates.
            </p>
          </div>

          <Button
            onClick={handleOpenCreate}
            className="shadow-md shadow-primary/10 hover:-translate-y-0.5 transition-transform"
            data-testid="button-new-dataset"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Dataset
          </Button>
        </div>

        <ReferenceDatasetGrid
          onEdit={handleOpenEdit}
          onDelete={(dataset) => setDeletingDataset(dataset)}
          onCreateFirst={handleOpenCreate}
        />
      </div>

      <ReferenceDataDrawer
        mode={drawerMode}
        dataset={editingDataset}
        onClose={handleDrawerClose}
        onSuccess={handleDrawerSuccess}
      />

      <DeleteDatasetModal
        dataset={deletingDataset}
        onClose={() => setDeletingDataset(null)}
        onDeleted={handleDeleteSuccess}
      />
    </div>
  );
}
