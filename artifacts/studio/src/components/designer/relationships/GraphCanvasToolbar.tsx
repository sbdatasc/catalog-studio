import { useReactFlow } from "@xyflow/react";
import { Plus, LayoutDashboard, Maximize2, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  isLocked: boolean;
  onAddRelationship: () => void;
  onAutoLayout: () => void;
  onExportPng: () => void;
}

export function GraphCanvasToolbar({ isLocked, onAddRelationship, onAutoLayout, onExportPng }: Props) {
  const { fitView } = useReactFlow();

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      {isLocked ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-400 text-sm font-medium shadow-sm">
          <Lock className="w-3.5 h-3.5" />
          Catalog locked — read only
        </div>
      ) : (
        <Button
          size="sm"
          onClick={onAddRelationship}
          data-testid="btn-add-relationship"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add Relationship
        </Button>
      )}

      <div className="flex items-center gap-1 bg-card border border-border rounded-lg shadow-sm p-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={onAutoLayout}
          title="Auto-layout"
          data-testid="btn-auto-layout"
        >
          <LayoutDashboard className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => fitView({ padding: 0.2 })}
          title="Fit view"
          data-testid="btn-fit-view"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
          onClick={onExportPng}
          title="Export as PNG"
          data-testid="btn-export-png"
        >
          <Download className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
