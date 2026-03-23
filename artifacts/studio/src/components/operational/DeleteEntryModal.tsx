import { useState } from "react";
import { Loader2, AlertCircle, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/apiClient";
import { useEntryStore } from "@/stores/entryStore";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  entryId: string;
  displayName: string;
  templateId: string;
  catalogStatus?: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteEntryModal({
  open,
  entryId,
  displayName,
  templateId,
  catalogStatus,
  onClose,
  onDeleted,
}: Props) {
  const { toast } = useToast();
  const removeEntry = useEntryStore((s) => s.removeEntry);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDiscontinued = catalogStatus === "discontinued";

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const { error: apiError } = await apiClient.entries.delete(entryId);
    setDeleting(false);

    if (apiError) {
      const code = (apiError.details as { code?: string } | null)?.code ?? apiError.code;
      if (code === "CATALOG_LOCKED") {
        setError("This catalog is discontinued. Entries cannot be deleted.");
      } else {
        setError("Could not delete this entry. Please try again.");
      }
      return;
    }

    removeEntry(templateId, entryId);
    toast({ title: "Entry deleted", description: `"${displayName}" has been removed.` });
    onClose();
    onDeleted?.();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Entry</DialogTitle>
        </DialogHeader>

        {isDiscontinued ? (
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              This catalog is discontinued. Entries cannot be deleted.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-foreground">
              Delete <strong>"{displayName}"</strong>? This will also remove all relationship links
              for this entry. This cannot be undone.
            </p>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            {isDiscontinued ? "Close" : "Cancel"}
          </Button>
          {!isDiscontinued && (
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Entry"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
