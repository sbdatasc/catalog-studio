import { useState } from "react";
import { useLocation } from "wouter";
import { MoreVertical, Pencil, Trash2, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteEntryModal } from "./DeleteEntryModal";
import type { EntryListItem, SnapshotTemplate } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props {
  entry: EntryListItem;
  template: SnapshotTemplate;
  catalogId: string;
  catalogStatus?: string;
  hasIncomplete: boolean;
  onEdit: (entryId: string) => void;
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function EntryCard({ entry, template, catalogId, catalogStatus, hasIncomplete, onEdit }: Props) {
  const [, navigate] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const detailPath = `/catalogs/${catalogId}/operational/${template.id}/entries/${entry.id}`;

  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-navigate]")) return;
    navigate(detailPath);
  }

  const previewAttrs = template.sections
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((s) =>
      s.attributes
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .filter((a) => a.attributeType !== "boolean"),
    )
    .slice(0, 3);

  return (
    <>
      <DeleteEntryModal
        open={deleteOpen}
        entryId={entry.id}
        displayName={entry.displayName}
        templateId={template.id}
        catalogStatus={catalogStatus}
        onClose={() => setDeleteOpen(false)}
      />

      <div
        className={cn(
          "group relative bg-card border rounded-xl p-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all",
          hasIncomplete ? "border-amber-300" : "border-border",
        )}
        onClick={handleCardClick}
        data-testid="entry-card"
      >
        {hasIncomplete && (
          <div className="absolute top-3 left-3" data-no-navigate>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              <AlertCircle className="w-3 h-3" />
              Incomplete
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 mt-0.5">
            <h3 className="font-semibold text-sm text-foreground truncate leading-snug">
              {entry.displayName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{template.name}</p>
          </div>

          <div data-no-navigate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  aria-label="Entry options"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(entry.id)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {previewAttrs.length > 0 && (
          <div className="mt-3 space-y-1">
            {previewAttrs.map((attr) => (
              <div key={attr.id} className="flex items-baseline gap-1 text-xs">
                <span className="text-muted-foreground font-medium shrink-0">{attr.name}:</span>
                <span className="text-foreground truncate">—</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Created {formatRelativeDate(entry.createdAt)}</span>
          <span>Updated {formatRelativeDate(entry.updatedAt)}</span>
        </div>
      </div>
    </>
  );
}
