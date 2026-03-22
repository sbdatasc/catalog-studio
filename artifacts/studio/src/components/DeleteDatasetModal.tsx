import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { type ReferenceDataset, apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  dataset: ReferenceDataset | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export function DeleteDatasetModal({ dataset, onClose, onDeleted }: Props) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorState, setErrorState] = useState<"NONE" | "IN_USE" | "NOT_FOUND" | "UNKNOWN">("NONE");

  const isOpen = !!dataset;

  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      onClose();
      setTimeout(() => setErrorState("NONE"), 300);
    }
  };

  const handleDelete = async () => {
    if (!dataset) return;

    setIsDeleting(true);
    setErrorState("NONE");

    const { error } = await apiClient.referenceData.deleteDataset(dataset.id);

    setIsDeleting(false);

    if (error) {
      if (error.code === "REFERENCE_DATA_IN_USE") {
        setErrorState("IN_USE");
      } else if (error.code === "NOT_FOUND") {
        setErrorState("NOT_FOUND");
      } else {
        setErrorState("UNKNOWN");
      }
      return;
    }

    toast({ title: "Success", description: "Reference dataset deleted." });
    onDeleted(dataset.id);
    setTimeout(() => setErrorState("NONE"), 300);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => setErrorState("NONE"), 300);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Delete Reference Dataset</DialogTitle>
          {errorState === "UNKNOWN" && (
            <div className="mt-2 p-3 bg-destructive/10 text-destructive text-sm rounded-md flex items-start gap-2 border border-destructive/20">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Something went wrong. Please try again.</p>
            </div>
          )}
        </DialogHeader>

        <div className="py-4">
          {errorState === "IN_USE" ? (
            <p className="text-foreground text-sm">
              <span className="font-semibold">{dataset?.name}</span> is used by one or more
              template attributes and cannot be deleted. Remove those attributes first.
            </p>
          ) : errorState === "NOT_FOUND" ? (
            <p className="text-foreground text-sm">This dataset no longer exists.</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">{dataset?.name}</span>? This cannot
              be undone. Existing entries that use values from this dataset will retain their stored
              values.
            </p>
          )}
        </div>

        <DialogFooter>
          {errorState === "IN_USE" || errorState === "NOT_FOUND" ? (
            <Button variant="outline" onClick={handleClose} data-testid="button-close-delete-dataset">
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isDeleting}
                data-testid="button-cancel-delete-dataset"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                data-testid="button-confirm-delete-dataset"
              >
                {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Delete
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
