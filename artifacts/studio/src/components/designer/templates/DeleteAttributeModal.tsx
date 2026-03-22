import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";
import { useSchemaStore } from "@/stores/schemaStore";
import { useToast } from "@/hooks/use-toast";
import type { AttributeDefinition } from "@/lib/apiClient";

interface Props {
  attribute: AttributeDefinition | null;
  onClose: () => void;
}

export function DeleteAttributeModal({ attribute, onClose }: Props) {
  const { removeAttribute } = useSchemaStore();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [inUseError, setInUseError] = useState(false);

  async function handleDelete() {
    if (!attribute) return;
    setDeleting(true);
    setInUseError(false);

    const { error } = await apiClient.schema.deleteAttribute(attribute.id);
    if (error) {
      if (error.code === "SECTION_IN_USE") {
        setInUseError(true);
      } else {
        toast({ title: "Failed to delete attribute", description: error.message, variant: "destructive" });
        onClose();
      }
      setDeleting(false);
      return;
    }

    removeAttribute(attribute.sectionId, attribute.id);
    toast({ title: "Attribute deleted." });
    setDeleting(false);
    onClose();
  }

  function handleClose() {
    setInUseError(false);
    onClose();
  }

  return (
    <AlertDialog open={!!attribute}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {attribute?.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {inUseError ? (
                <span className="text-destructive">
                  This attribute has data in existing entries and cannot be deleted.
                </span>
              ) : (
                "This cannot be undone."
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancel</AlertDialogCancel>
          {!inUseError && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              data-testid="button-confirm-delete-attribute"
            >
              {deleting ? "Deleting…" : "Delete Attribute"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
