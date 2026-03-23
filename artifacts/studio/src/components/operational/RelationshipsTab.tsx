import { useEffect, useState } from "react";
import { Loader2, AlertCircle, Plus, X, Link2 } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useEntryStore } from "@/stores/entryStore";
import { usePermissions } from "@/hooks/usePermissions";
import { RelationshipLinkDrawer } from "./RelationshipLinkDrawer";
import { UnlinkConfirmModal } from "./UnlinkConfirmModal";
import type { EntryLinkInstance, SnapshotRelationship } from "@/lib/apiClient";

interface Props {
  entryId: string;
  entryName: string;
  templateId: string;
  catalogId: string;
  relationships: SnapshotRelationship[];
  isDiscontinued?: boolean;
}

export function RelationshipsTab({
  entryId,
  entryName,
  templateId,
  catalogId,
  relationships,
  isDiscontinued,
}: Props) {
  const [, navigate] = useLocation();
  const { canLinkEntries } = usePermissions(catalogId);
  const linksByEntry = useEntryStore((s) => s.linksByEntry);
  const linksLoading = useEntryStore((s) => s.linksLoading);
  const fetchLinks = useEntryStore((s) => s.fetchLinks);

  const [selectedRelId, setSelectedRelId] = useState<string>(relationships[0]?.id ?? "");
  const [activeAddRel, setActiveAddRel] = useState<SnapshotRelationship | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<EntryLinkInstance | null>(null);
  const [loadError, setLoadError] = useState(false);

  const links = linksByEntry[entryId] ?? [];
  const loading = linksLoading[entryId] ?? false;

  useEffect(() => {
    fetchLinks(entryId).catch(() => setLoadError(true));
  }, [entryId, fetchLinks]);

  const selectedRel = relationships.find((r) => r.id === selectedRelId);
  const selectedLinks = links.filter((l) => l.relationshipId === selectedRelId);
  const totalLinkCount = links.length;

  if (loading && links.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm py-4">
        <AlertCircle className="w-4 h-4" />
        Could not load related entries. Please try again.
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-full min-h-[320px]">
      <div className="w-56 shrink-0 border-r border-border pr-4 space-y-1">
        {relationships.map((rel) => {
          const count = links.filter((l) => l.relationshipId === rel.id).length;
          const isActive = selectedRelId === rel.id;
          return (
            <button
              key={rel.id}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              onClick={() => setSelectedRelId(rel.id)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{rel.label}</span>
              </div>
              {count > 0 && (
                <span className="ml-2 shrink-0 text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-0">
        {selectedRel && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm text-foreground">{selectedRel.label}</h4>
                <p className="text-xs text-muted-foreground">{selectedRel.cardinality}</p>
              </div>
              {!isDiscontinued && canLinkEntries && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setActiveAddRel(selectedRel)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Link
                </Button>
              )}
            </div>

            {selectedLinks.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center border-2 border-dashed border-border rounded-lg">
                No {selectedRel.label} links yet.
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                {selectedLinks.map((link) => {
                  const isFrom = link.direction === "from";
                  const linkedEntryId = isFrom ? link.toEntryId : link.fromEntryId;
                  const linkedEntryName = isFrom ? link.toEntryName : link.fromEntryName;
                  const linkedTemplateId = isFrom ? link.toTemplateId : link.fromTemplateId;
                  const linkedTemplateName = isFrom ? link.toTemplateName : "";

                  return (
                    <div
                      key={link.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <button
                        className="flex items-center gap-3 text-left flex-1 min-w-0"
                        onClick={() =>
                          navigate(
                            `/catalogs/${catalogId}/operational/${linkedTemplateId}/entries/${linkedEntryId}`,
                          )
                        }
                      >
                        <span className="text-sm font-medium text-foreground truncate">
                          {linkedEntryName}
                        </span>
                        {linkedTemplateName && (
                          <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                            {linkedTemplateName}
                          </span>
                        )}
                      </button>
                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        <span className="text-xs text-muted-foreground">
                          {new Date(link.createdAt).toLocaleDateString()}
                        </span>
                        {!isDiscontinued && canLinkEntries && (
                          <button
                            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            onClick={() => setUnlinkTarget(link)}
                            title="Remove link"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {activeAddRel && (
        <RelationshipLinkDrawer
          relationship={activeAddRel}
          currentEntryId={entryId}
          currentTemplateId={templateId}
          currentEntryName={entryName}
          catalogId={catalogId}
          existingLinks={links}
          onClose={() => setActiveAddRel(null)}
        />
      )}

      {unlinkTarget && (
        <UnlinkConfirmModal
          link={unlinkTarget}
          currentEntryId={entryId}
          onClose={() => setUnlinkTarget(null)}
        />
      )}
    </div>
  );
}
