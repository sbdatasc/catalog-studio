import { Pencil, Trash2, LayoutTemplate } from "lucide-react";
import { EntityType } from "@/lib/apiClient";
import { useUiStore } from "@/stores/uiStore";
import { Badge } from "@/components/ui/badge";

interface Props {
  entityType: EntityType;
}

export function EntityTypeCard({ entityType }: Props) {
  const { openEditDrawer, openDeleteModal } = useUiStore();

  return (
    <div 
      className="group relative flex flex-col bg-card rounded-xl border border-border p-5 hover-elevate transition-all duration-200"
      data-testid={`card-entity-type-${entityType.id}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-display font-semibold text-foreground text-lg truncate">
            {entityType.name}
          </h3>
          {entityType.isSystemSeed && (
            <Badge variant="secondary" className="font-normal text-xs bg-muted text-muted-foreground pointer-events-none">
              System
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => openEditDrawer(entityType.id)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            data-testid={`button-edit-entity-type-${entityType.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          
          {!entityType.isSystemSeed && (
            <button 
              onClick={() => openDeleteModal(entityType.id)}
              className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              data-testid={`button-delete-entity-type-${entityType.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] leading-relaxed">
        {entityType.description ? (
          entityType.description
        ) : (
          <span className="italic opacity-70">No description</span>
        )}
      </p>

      <div className="mt-5 pt-4 border-t border-border/50 flex items-center text-xs font-medium text-muted-foreground">
        <LayoutTemplate className="w-3.5 h-3.5 mr-1.5 opacity-70" />
        {entityType.fieldCount} {entityType.fieldCount === 1 ? 'field' : 'fields'}
      </div>
    </div>
  );
}
