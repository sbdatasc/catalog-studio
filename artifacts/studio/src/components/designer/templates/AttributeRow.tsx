import { Pencil, Trash2, ChevronUp, ChevronDown, Asterisk } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AttributeDefinition } from "@/lib/apiClient";
import { TYPE_BADGE_COLORS } from "./AttributeInlineForm";

interface Props {
  attribute: AttributeDefinition;
  isFirst: boolean;
  isLast: boolean;
  isCatalogLocked: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function AttributeRow({
  attribute,
  isFirst,
  isLast,
  isCatalogLocked,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: Props) {
  const badgeColor = TYPE_BADGE_COLORS[attribute.attributeType] ?? "bg-muted text-muted-foreground";

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group rounded-md"
      data-testid={`attribute-row-${attribute.id}`}
    >
      {/* Reorder arrows */}
      {!isCatalogLocked && (
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            aria-label="Move attribute up"
            data-testid={`button-attr-up-${attribute.id}`}
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            aria-label="Move attribute down"
            data-testid={`button-attr-down-${attribute.id}`}
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{attribute.name}</span>
          {attribute.required && (
            <Asterisk className="w-3 h-3 text-destructive shrink-0" aria-label="Required" />
          )}
        </div>
        {attribute.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{attribute.description}</p>
        )}
      </div>

      {/* Type badge */}
      <Badge
        variant="secondary"
        className={`text-xs font-medium shrink-0 pointer-events-none ${badgeColor}`}
      >
        {attribute.attributeType}
      </Badge>

      {/* Edit / Delete */}
      {!isCatalogLocked && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onEdit}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            aria-label="Edit attribute"
            data-testid={`button-edit-attribute-${attribute.id}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            aria-label="Delete attribute"
            data-testid={`button-delete-attribute-${attribute.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
