import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle } from "lucide-react";

export function DeleteConfirmModal() {
  const { deleteModalEntityTypeId, closeDeleteModal } = useUiStore();
  const { entityTypes, removeEntityType, fetchEntityTypes } = useSchemaStore();
  const { toast } = useToast();
  
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorState, setErrorState] = useState<"NONE" | "IN_USE" | "NOT_FOUND" | "UNKNOWN">("NONE");

  const entityType = entityTypes.find(et => et.id === deleteModalEntityTypeId);
  const isOpen = !!deleteModalEntityTypeId && !!entityType;

  const handleOpenChange = (open: boolean) => {
    if (!open && !isDeleting) {
      closeDeleteModal();
      // Reset error state after animation completes
      setTimeout(() => setErrorState("NONE"), 300);
    }
  };

  const handleDelete = async () => {
    if (!entityType) return;
    
    setIsDeleting(true);
    setErrorState("NONE");
    
    const { error } = await apiClient.schema.deleteEntityType(entityType.id);
    
    setIsDeleting(false);
    
    if (error) {
      if (error.code === "ENTITY_TYPE_IN_USE") {
        setErrorState("IN_USE");
      } else if (error.code === "NOT_FOUND") {
        setErrorState("NOT_FOUND");
      } else {
        setErrorState("UNKNOWN");
      }
      return;
    }

    removeEntityType(entityType.id);
    closeDeleteModal();
    setTimeout(() => setErrorState("NONE"), 300);
    toast({
      title: "Success",
      description: "Entity type deleted",
    });
  };

  const handleCloseAndRefresh = () => {
    closeDeleteModal();
    fetchEntityTypes();
    setTimeout(() => setErrorState("NONE"), 300);
  };

  if (!entityType && deleteModalEntityTypeId) {
    return null; // Handle edge case where ID is set but entity is gone
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Entity Type</DialogTitle>
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
              <span className="font-semibold">{entityType?.name}</span> has catalog entries and cannot be deleted. Remove all entries for this type before deleting it.
            </p>
          ) : errorState === "NOT_FOUND" ? (
            <p className="text-foreground text-sm">
              This entity type no longer exists.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              Are you sure you want to delete <span className="font-semibold text-foreground">{entityType?.name}</span>? This cannot be undone.
            </p>
          )}
        </div>

        <DialogFooter>
          {errorState === "IN_USE" ? (
            <Button variant="outline" onClick={closeDeleteModal} data-testid="button-cancel-delete">
              Close
            </Button>
          ) : errorState === "NOT_FOUND" ? (
            <Button variant="outline" onClick={handleCloseAndRefresh} data-testid="button-cancel-delete">
              Close
            </Button>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={closeDeleteModal} 
                disabled={isDeleting}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                disabled={isDeleting}
                data-testid="button-confirm-delete"
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
