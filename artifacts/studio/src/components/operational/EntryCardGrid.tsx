import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntryCard } from "./EntryCard";
import { LinkModeOverlay } from "./LinkModeOverlay";
import { RelationshipSelectionDialog } from "./RelationshipSelectionDialog";
import { getCompatibleTemplateIds } from "@/utils/getCompatibleTemplateIds";
import { useUiStore } from "@/stores/uiStore";
import type {
  EntryListItem,
  SnapshotTemplate,
  SchemaSnapshot,
  SnapshotRelationship,
  EntryLinkInstance,
} from "@/lib/apiClient";

interface Props {
  entries: EntryListItem[];
  template: SnapshotTemplate;
  catalogId: string;
  catalogStatus?: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onEdit: (entryId: string) => void;
  snapshot?: SchemaSnapshot;
}

function hasIncompleteFields(_entry: EntryListItem, template: SnapshotTemplate): boolean {
  const requiredAttrs = template.sections.flatMap((s) =>
    s.attributes.filter((a) => a.required),
  );
  if (requiredAttrs.length === 0) return false;
  return false;
}

function getApplicableRelationships(
  sourceTemplateId: string,
  targetTemplateId: string,
  snapshot: SchemaSnapshot,
): SnapshotRelationship[] {
  const rels: SnapshotRelationship[] = [];
  for (const t of snapshot.templates) {
    for (const rel of t.relationships) {
      const connects =
        (rel.fromTemplateId === sourceTemplateId && rel.toTemplateId === targetTemplateId) ||
        (rel.fromTemplateId === targetTemplateId && rel.toTemplateId === sourceTemplateId);
      if (connects && !rels.find((r) => r.id === rel.id)) {
        rels.push(rel);
      }
    }
  }
  return rels;
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
  snapshot,
}: Props) {
  const [linkSourceEntry, setLinkSourceEntry] = useState<EntryListItem | null>(null);
  const [pendingTarget, setPendingTarget] = useState<EntryListItem | null>(null);
  const [compatibleTemplateIds, setCompatibleTemplateIds] = useState<string[]>([]);

  const isInLinkMode = linkSourceEntry !== null;

  // Multi-select state from uiStore
  const isMultiSelectMode = useUiStore((s) => s.isMultiSelectMode);
  const selectedEntryIds = useUiStore((s) => s.selectedEntryIds);
  const enterMultiSelectMode = useUiStore((s) => s.enterMultiSelectMode);
  const exitMultiSelectMode = useUiStore((s) => s.exitMultiSelectMode);
  const toggleEntrySelection = useUiStore((s) => s.toggleEntrySelection);

  const cancelLinkMode = useCallback(() => {
    setLinkSourceEntry(null);
    setPendingTarget(null);
    setCompatibleTemplateIds([]);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isMultiSelectMode) {
          exitMultiSelectMode();
        } else if (isInLinkMode) {
          cancelLinkMode();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isInLinkMode, isMultiSelectMode, cancelLinkMode, exitMultiSelectMode]);

  function handleToggleSelect(entryId: string) {
    if (!isMultiSelectMode) {
      enterMultiSelectMode();
    }
    toggleEntrySelection(entryId);
  }

  function handleLinkDragStart(e: React.DragEvent, entry: EntryListItem) {
    if (!snapshot || isMultiSelectMode) return;
    e.dataTransfer.setData("text/plain", entry.id);
    e.dataTransfer.effectAllowed = "link";
    const compatible = getCompatibleTemplateIds(entry.templateId, snapshot);
    setCompatibleTemplateIds(compatible);
    setLinkSourceEntry(entry);
  }

  function handleDropLink(target: EntryListItem) {
    if (!linkSourceEntry || !snapshot) return;
    if (target.id === linkSourceEntry.id) return;
    setPendingTarget(target);
  }

  function handleLinked(_link: EntryLinkInstance) {
    cancelLinkMode();
  }

  const applicableRels =
    linkSourceEntry && pendingTarget && snapshot
      ? getApplicableRelationships(linkSourceEntry.templateId, pendingTarget.templateId, snapshot)
      : [];

  return (
    <>
      {isInLinkMode && <LinkModeOverlay onCancel={cancelLinkMode} />}

      {pendingTarget && linkSourceEntry && applicableRels.length > 0 && (
        <RelationshipSelectionDialog
          sourceEntry={linkSourceEntry}
          targetEntry={pendingTarget}
          relationships={applicableRels}
          onClose={cancelLinkMode}
          onLinked={handleLinked}
        />
      )}

      <div>
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          data-testid="entry-card-grid"
        >
          {entries.map((entry) => {
            const isSource = linkSourceEntry?.id === entry.id;
            const isCompatible =
              isInLinkMode && !isSource && compatibleTemplateIds.includes(entry.templateId);

            return (
              <EntryCard
                key={entry.id}
                entry={entry}
                template={template}
                catalogId={catalogId}
                catalogStatus={catalogStatus}
                hasIncomplete={hasIncompleteFields(entry, template)}
                onEdit={onEdit}
                isInLinkMode={isInLinkMode}
                isLinkSource={isSource}
                isCompatibleTarget={isCompatible}
                onLinkDragStart={snapshot && !isMultiSelectMode ? handleLinkDragStart : undefined}
                onDropLink={handleDropLink}
                isMultiSelectMode={isMultiSelectMode}
                isSelected={selectedEntryIds.has(entry.id)}
                onToggleSelect={handleToggleSelect}
              />
            );
          })}
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
    </>
  );
}
