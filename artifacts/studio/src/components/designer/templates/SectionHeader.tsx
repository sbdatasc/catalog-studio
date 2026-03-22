import { GripVertical, ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  name: string;
  attributeCount: number;
  isExpanded: boolean;
  isCatalogLocked: boolean;
  dragHandleProps?: Record<string, unknown>;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SectionHeader({
  name,
  attributeCount,
  isExpanded,
  isCatalogLocked,
  dragHandleProps,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-2 px-4 h-12 group select-none">
      {/* Drag handle */}
      {!isCatalogLocked && (
        <span
          {...(dragHandleProps as Record<string, unknown>)}
          className="cursor-grab text-muted-foreground hover:text-foreground transition-colors shrink-0 p-1"
          aria-label="Drag to reorder section"
          data-testid="section-drag-handle"
        >
          <GripVertical className="w-4 h-4" />
        </span>
      )}

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-2 flex-1 text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <span className="font-semibold text-sm text-foreground">{name}</span>
        <Badge variant="outline" className="text-xs font-normal ml-1 shrink-0">
          {attributeCount} {attributeCount === 1 ? "attribute" : "attributes"}
        </Badge>
      </button>

      {/* Edit / Delete */}
      {!isCatalogLocked && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            aria-label="Edit section"
            data-testid={`button-edit-section-${name}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            aria-label="Delete section"
            data-testid={`button-delete-section-${name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
