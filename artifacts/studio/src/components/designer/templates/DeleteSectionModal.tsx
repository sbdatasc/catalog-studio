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
import type { Section } from "@/lib/apiClient";

interface Props {
  section: Section | null;
  templateId: string;
  onClose: () => void;
}

export function DeleteSectionModal({ section, templateId, onClose }: Props) {
  const { removeSection } = useSchemaStore();
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [inUseError, setInUseError] = useState(false);

  async function handleDelete() {
    if (!section) return;
    setDeleting(true);
    setInUseError(false);

    const { error } = await apiClient.schema.deleteSection(section.id);
    if (error) {
      if (error.code === "SECTION_IN_USE") {
        setInUseError(true);
      } else {
        toast({ title: "Failed to delete section", description: error.message, variant: "destructive" });
        onClose();
      }
      setDeleting(false);
      return;
    }

    removeSection(templateId, section.id);
    toast({ title: "Section deleted." });
    setDeleting(false);
    onClose();
  }

  function handleClose() {
    setInUseError(false);
    onClose();
  }

  return (
    <AlertDialog open={!!section}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {section?.name}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              {inUseError ? (
                <span className="text-destructive">
                  This section has data in existing entries and cannot be deleted. Remove the entries first.
                </span>
              ) : section && section.attributeCount > 0 ? (
                <>
                  This will also delete all{" "}
                  <strong>{section.attributeCount}</strong>{" "}
                  {section.attributeCount === 1 ? "attribute" : "attributes"} inside it. This cannot be undone.
                </>
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
              data-testid="button-confirm-delete-section"
            >
              {deleting ? "Deleting…" : "Delete Section"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
