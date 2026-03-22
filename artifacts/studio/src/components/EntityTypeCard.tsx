import { Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { type CatalogTemplate } from "@/lib/apiClient";
import { useUiStore } from "@/stores/uiStore";
import { Badge } from "@/components/ui/badge";

interface Props {
  template: CatalogTemplate;
}

export function EntityTypeCard({ template }: Props) {
  const { openEditDrawer, openDeleteModal } = useUiStore();

  return (
    <div
      className="group relative flex flex-col bg-card rounded-xl border border-border p-5 hover-elevate transition-all duration-200"
      data-testid={`card-template-${template.id}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-semibold text-foreground text-lg truncate">
            {template.name}
          </h3>
          {template.isReferenceData && (
            <Badge
              variant="secondary"
              className="font-normal text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 pointer-events-none"
            >
              Reference Data
            </Badge>
          )}
          {template.isSystemSeed && !template.isReferenceData && (
            <Badge
              variant="secondary"
              className="font-normal text-xs bg-muted text-muted-foreground pointer-events-none"
            >
              System
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => openEditDrawer(template.id)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            data-testid={`button-edit-template-${template.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>

          {!template.isSystemSeed && (
            <button
              onClick={() => openDeleteModal(template.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              data-testid={`button-delete-template-${template.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] leading-relaxed">
        {template.description ? (
          template.description
        ) : (
          <span className="italic opacity-70">No description</span>
        )}
      </p>

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center gap-4 text-xs font-medium text-muted-foreground">
        <span className="flex items-center">
          <LayoutTemplate className="w-3.5 h-3.5 mr-1.5 opacity-70" />
          {template.sectionCount} {template.sectionCount === 1 ? "section" : "sections"}
        </span>
        <span>
          {template.attributeCount} {template.attributeCount === 1 ? "attribute" : "attributes"}
        </span>
      </div>
    </div>
  );
}
