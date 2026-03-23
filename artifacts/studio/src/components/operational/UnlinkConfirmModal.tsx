import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiClient } from "@/lib/apiClient";
import type { EntryLinkInstance } from "@/lib/apiClient";
import { useEntryStore } from "@/stores/entryStore";
import { useToast } from "@/hooks/use-toast";

interface Props {
  link: EntryLinkInstance;
  currentEntryId: string;
  onClose: () => void;
}

export function UnlinkConfirmModal({ link, currentEntryId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const removeLink = useEntryStore((s) => s.removeLink);
  const { toast } = useToast();

  async function handleConfirm() {
    setLoading(true);
    setErrorMsg(null);
    const { error } = await apiClient.entries.unlink(currentEntryId, link.id);
    setLoading(false);
    if (error) {
      if (error.details?.code === "CATALOG_LOCKED") {
        setErrorMsg("This catalog is discontinued. Links cannot be removed.");
      } else {
        setErrorMsg("Could not remove link. Please try again.");
      }
      return;
    }
    removeLink(currentEntryId, link.id);
    toast({ title: "Link removed" });
    onClose();
  }

  const otherName =
    link.direction === "from" ? link.toEntryName : link.fromEntryName;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Remove Link
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <p className="text-sm text-foreground">
            Remove link between{" "}
            <span className="font-medium">{link.fromEntryName}</span> and{" "}
            <span className="font-medium">{link.toEntryName}</span> via{" "}
            <span className="font-medium">{link.relationshipLabel}</span>?
          </p>
          <p className="text-sm text-muted-foreground">
            The entries themselves will not be deleted.
          </p>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Remove Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
