import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/apiClient";
import type { EntryLinkInstance, SnapshotRelationship, EntryListItem } from "@/lib/apiClient";
import { useEntryStore } from "@/stores/entryStore";
import { useToast } from "@/hooks/use-toast";

interface Props {
  sourceEntry: EntryListItem;
  targetEntry: EntryListItem;
  relationships: SnapshotRelationship[];
  onClose: () => void;
  onLinked: (link: EntryLinkInstance) => void;
}

export function RelationshipSelectionDialog({
  sourceEntry,
  targetEntry,
  relationships,
  onClose,
  onLinked,
}: Props) {
  const [selectedRelId, setSelectedRelId] = useState<string>("");
  const [linking, setLinking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const addLink = useEntryStore((s) => s.addLink);
  const { toast } = useToast();

  const selectedRel = relationships.find((r) => r.id === selectedRelId);

  async function handleConfirm() {
    if (!selectedRel) return;
    setLinking(true);
    setErrorMsg(null);

    const { data, error } = await apiClient.entries.link(sourceEntry.id, {
      relationshipId: selectedRel.id,
      toEntryId: targetEntry.id,
    });

    setLinking(false);
    if (error) {
      if (error.details?.code === "CONFLICT") {
        setErrorMsg(error.message ?? "This relationship only allows one link. Remove the existing link first.");
      } else {
        setErrorMsg("Could not create link. Please try again.");
      }
      return;
    }
    if (data) {
      addLink(sourceEntry.id, data);
      toast({
        title: `${sourceEntry.displayName} linked to ${targetEntry.displayName} via ${selectedRel.label}.`,
      });
      onLinked(data);
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Relationship Type</DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sourceEntry.displayName}</span>
            {" → "}
            <span className="font-medium text-foreground">{targetEntry.displayName}</span>
          </div>

          <Select value={selectedRelId} onValueChange={setSelectedRelId}>
            <SelectTrigger>
              <SelectValue placeholder="Select relationship type..." />
            </SelectTrigger>
            <SelectContent>
              {relationships.map((rel) => (
                <SelectItem key={rel.id} value={rel.id}>
                  {rel.label} ({rel.cardinality}, {rel.direction})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {errorMsg && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {errorMsg}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={linking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedRelId || linking || !!errorMsg}>
            {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
