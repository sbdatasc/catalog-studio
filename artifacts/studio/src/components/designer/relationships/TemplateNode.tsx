import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Layers, Plus } from "lucide-react";

export interface TemplateNodeData {
  name: string;
  sectionCount: number;
  attributeCount: number;
  isReferenceData: boolean;
  isLocked: boolean;
  onAddRelationship: (templateId: string) => void;
  [key: string]: unknown;
}

function TemplateNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as TemplateNodeData;

  return (
    <div
      className={[
        "bg-card border rounded-xl shadow-sm transition-all duration-150 w-52 group",
        selected
          ? "border-primary ring-2 ring-primary/20 shadow-md"
          : "border-border hover:border-primary/50 hover:shadow-md",
      ].join(" ")}
      data-testid={`template-node-${id}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      <div className="p-4">
        <div className="flex items-start gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight truncate" title={d.name}>
              {d.name}
            </p>
            {d.isReferenceData && (
              <span className="inline-block mt-0.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                Ref Data
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {d.sectionCount} {d.sectionCount === 1 ? "section" : "sections"} ·{" "}
              {d.attributeCount} {d.attributeCount === 1 ? "attr" : "attrs"}
            </p>
          </div>
        </div>

        {!d.isLocked && (
          <button
            className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary border border-dashed border-border hover:border-primary rounded-lg py-1.5 transition-colors opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              d.onAddRelationship(id);
            }}
            title="Add relationship from this template"
          >
            <Plus className="w-3 h-3" />
            Add Relationship
          </button>
        )}
      </div>
    </div>
  );
}

export const TemplateNode = memo(TemplateNodeComponent);
