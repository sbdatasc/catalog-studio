import { useEffect, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useEntryStore } from "@/stores/entryStore";
import { RelationshipSubsection } from "./RelationshipSubsection";
import { RelationshipLinkDrawer } from "./RelationshipLinkDrawer";
import type { SnapshotRelationship } from "@/lib/apiClient";

interface Props {
  entryId: string;
  entryName: string;
  templateId: string;
  catalogId: string;
  relationships: SnapshotRelationship[];
  isDiscontinued?: boolean;
}

export function RelatedEntriesSection({
  entryId,
  entryName,
  templateId,
  catalogId,
  relationships,
  isDiscontinued,
}: Props) {
  const linksByEntry = useEntryStore((s) => s.linksByEntry);
  const linksLoading = useEntryStore((s) => s.linksLoading);
  const fetchLinks = useEntryStore((s) => s.fetchLinks);

  const [activeRel, setActiveRel] = useState<SnapshotRelationship | null>(null);
  const [loadError, setLoadError] = useState(false);

  const links = linksByEntry[entryId] ?? [];
  const loading = linksLoading[entryId] ?? false;

  useEffect(() => {
    fetchLinks(entryId).catch(() => setLoadError(true));
  }, [entryId, fetchLinks]);

  if (loading && links.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
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
    <div className="space-y-3">
      <h3 className="font-semibold text-base text-foreground">Related Entries</h3>
      {relationships.map((rel) => (
        <RelationshipSubsection
          key={rel.id}
          relationship={rel}
          links={links}
          currentEntryId={entryId}
          catalogId={catalogId}
          isDiscontinued={isDiscontinued}
          onAddLink={(r) => setActiveRel(r)}
        />
      ))}

      {activeRel && (
        <RelationshipLinkDrawer
          relationship={activeRel}
          currentEntryId={entryId}
          currentTemplateId={templateId}
          currentEntryName={entryName}
          catalogId={catalogId}
          existingLinks={links}
          onClose={() => setActiveRel(null)}
        />
      )}
    </div>
  );
}
