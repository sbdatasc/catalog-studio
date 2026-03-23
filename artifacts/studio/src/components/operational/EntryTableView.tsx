import { useState } from "react";
import { useLocation } from "wouter";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteEntryModal } from "./DeleteEntryModal";
import { PaginationControls } from "./PaginationControls";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntryListItem, SnapshotTemplate, SnapshotAttribute } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props {
  entries: EntryListItem[];
  template: SnapshotTemplate;
  catalogId: string;
  catalogStatus?: string;
  selectedColumns: string[];
  total: number;
  page: number;
  limit: number;
  onNextPage: () => void;
  onPrevPage: () => void;
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
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
}

function TableRow({
  entry,
  template,
  catalogId,
  catalogStatus,
  columnAttrs,
  onEdit,
}: {
  entry: EntryListItem;
  template: SnapshotTemplate;
  catalogId: string;
  catalogStatus?: string;
  columnAttrs: SnapshotAttribute[];
  onEdit: (id: string) => void;
}) {
  const [, navigate] = useLocation();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { canEditEntries, canDeleteEntries } = usePermissions(catalogId);

  const detailPath = `/catalogs/${catalogId}/operational/${template.id}/entries/${entry.id}`;

  function handleRowClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-no-navigate]")) return;
    navigate(detailPath);
  }

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
      <tr
        className="group hover:bg-muted/40 cursor-pointer border-b border-border transition-colors"
        onClick={handleRowClick}
        data-testid="entry-table-row"
      >
        <td className="px-4 py-3 font-medium text-sm text-foreground truncate max-w-[200px]">
          {entry.displayName}
        </td>
        {columnAttrs.map((attr) => (
          <td key={attr.id} className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[180px]">
            —
          </td>
        ))}
        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
          {formatRelativeDate(entry.updatedAt)}
        </td>
        {(canEditEntries || canDeleteEntries) && (
          <td className="px-4 py-3 w-10" data-no-navigate>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
                  aria-label="Row options"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEditEntries && (
                  <DropdownMenuItem onClick={() => onEdit(entry.id)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDeleteEntries && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        )}
      </tr>
    </>
  );
}

export function EntryTableView({
  entries,
  template,
  catalogId,
  catalogStatus,
  selectedColumns,
  total,
  page,
  limit,
  onNextPage,
  onPrevPage,
  onEdit,
}: Props) {
  const allAttrs = template.sections
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .flatMap((s) => s.attributes.slice().sort((a, b) => a.displayOrder - b.displayOrder));

  const columnAttrs = selectedColumns
    .map((id) => allAttrs.find((a) => a.id === id))
    .filter((a): a is SnapshotAttribute => !!a);

  return (
    <div data-testid="entry-table-view">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Display Name
              </th>
              {columnAttrs.map((attr) => (
                <th
                  key={attr.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                >
                  {attr.name}
                </th>
              ))}
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Updated
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                entry={entry}
                template={template}
                catalogId={catalogId}
                catalogStatus={catalogStatus}
                columnAttrs={columnAttrs}
                onEdit={onEdit}
              />
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={page}
        total={total}
        limit={limit}
        onPrev={onPrevPage}
        onNext={onNextPage}
      />
    </div>
  );
}
