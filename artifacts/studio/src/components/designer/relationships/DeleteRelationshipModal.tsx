import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import { useUiStore } from "@/stores/uiStore";
import { useSchemaStore } from "@/stores/schemaStore";
import { apiClient } from "@/lib/apiClient";
import { useToast } from "@/hooks/use-toast";

interface Props {
  catalogId: string;
}

export function DeleteRelationshipModal({ catalogId }: Props) {
  const { toast } = useToast();
  const { deleteRelModalId, closeDeleteRelModal } = useUiStore();
  const { relationshipsByCatalog, removeRelationship } = useSchemaStore();

  const [deleting, setDeleting] = useState(false);

  const rel = deleteRelModalId
    ? (relationshipsByCatalog[catalogId] ?? []).find((r) => r.id === deleteRelModalId)
    : null;

  const isOpen = deleteRelModalId !== null && !!rel;

  async function handleDelete() {
    if (!rel) return;
    setDeleting(true);

    const { error } = await apiClient.schema.deleteRelationship(rel.id);
    setDeleting(false);

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      removeRelationship(catalogId, rel.id);
      toast({ title: "Relationship deleted" });
      closeDeleteRelModal();
    }
  }

  if (!rel) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && closeDeleteRelModal()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Relationship</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Are you sure you want to delete the relationship{" "}
                <strong>&ldquo;{rel.label}&rdquo;</strong> between{" "}
                <strong>{rel.fromTemplateName}</strong> and{" "}
                <strong>{rel.toTemplateName}</strong>?
              </p>

              {rel.entryLinkCount > 0 && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/50">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <strong>{rel.entryLinkCount}</strong> existing entry{" "}
                    {rel.entryLinkCount === 1 ? "link" : "links"} using this relationship will
                    also be permanently removed.
                  </p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-testid="btn-confirm-delete-rel"
          >
            {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete Relationship
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
