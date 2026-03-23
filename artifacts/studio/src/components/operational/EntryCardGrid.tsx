import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryCard } from "./EntryCard";
import type { EntryListItem, SnapshotTemplate } from "@/lib/apiClient";

interface Props {
  entries: EntryListItem[];
  template: SnapshotTemplate;
  catalogId: string;
  catalogStatus?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onEdit: (entryId: string) => void;
}

function hasIncompleteFields(entry: EntryListItem, template: SnapshotTemplate): boolean {
  const requiredAttrs = template.sections.flatMap((s) =>
    s.attributes.filter((a) => a.required),
  );
  if (requiredAttrs.length === 0) return false;
  return false;
}

export function EntryCardGrid({
  entries,
  template,
  catalogId,
  catalogStatus,
  hasMore,
  loadingMore,
  onLoadMore,
  onEdit,
}: Props) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="entry-card-grid">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            template={template}
            catalogId={catalogId}
            catalogStatus={catalogStatus}
            hasIncomplete={hasIncompleteFields(entry, template)}
            onEdit={onEdit}
          />
        ))}
      </div>

      {hasMore && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading…
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
