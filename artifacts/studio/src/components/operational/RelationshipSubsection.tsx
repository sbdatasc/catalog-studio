import { useState } from "react";
import { ChevronDown, ChevronRight, Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryLinkChip } from "./EntryLinkChip";
import type { EntryLinkInstance, SnapshotRelationship } from "@/lib/apiClient";

interface Props {
  relationship: SnapshotRelationship;
  links: EntryLinkInstance[];
  currentEntryId: string;
  catalogId: string;
  isDiscontinued?: boolean;
  onAddLink: (rel: SnapshotRelationship) => void;
}

export function RelationshipSubsection({
  relationship,
  links,
  currentEntryId,
  catalogId,
  isDiscontinued,
  onAddLink,
}: Props) {
  const [open, setOpen] = useState(true);

  const relLinks = links.filter((l) => l.relationshipId === relationship.id);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm text-foreground">{relationship.label}</span>
          <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
            {relationship.cardinality}
          </span>
          <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
            {relLinks.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="p-4">
          {relLinks.length === 0 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No {relationship.label} links yet.
              </p>
              {!isDiscontinued && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddLink(relationship)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Link
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {relLinks.map((link) => (
                  <EntryLinkChip
                    key={link.id}
                    link={link}
                    currentEntryId={currentEntryId}
                    catalogId={catalogId}
                    isDiscontinued={isDiscontinued}
                  />
                ))}
              </div>
              {!isDiscontinued && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onAddLink(relationship)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Link
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
