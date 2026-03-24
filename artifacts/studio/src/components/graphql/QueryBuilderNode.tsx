import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import { Layers, CheckSquare } from "lucide-react";

export interface QueryBuilderNodeData {
  name: string;
  isReferenceData: boolean;
  totalFieldCount: number;
  selectedFieldCount: number;
  isRoot: boolean;
  isExpanded: boolean; // linked via expanded relationship
  onSetRoot: (templateId: string) => void;
  [key: string]: unknown;
}

function QueryBuilderNodeComponent({ id, data }: NodeProps) {
  const d = data as QueryBuilderNodeData;

  const ringClass = d.isRoot
    ? "border-primary ring-2 ring-primary/40 shadow-md"
    : d.isExpanded
      ? "border-primary ring-2 ring-primary/20 ring-dashed shadow-md"
      : "border-border hover:border-primary/50 hover:shadow-md";

  return (
    <div
      className={[
        "bg-card border rounded-xl shadow-sm transition-all duration-150 w-52 cursor-pointer select-none",
        ringClass,
      ].join(" ")}
      data-testid={`qb-node-${id}`}
      onClick={() => d.onSetRoot(id)}
    >
      {/* NO connection handles — query builder canvas is read-only */}

      <div className="p-4">
        <div className="flex items-start gap-2">
          <div
            className={[
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              d.isRoot ? "bg-primary/20" : "bg-primary/10",
            ].join(" ")}
          >
            <Layers
              className={["w-4 h-4", d.isRoot ? "text-primary" : "text-primary/70"].join(" ")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-foreground leading-tight truncate"
              title={d.name}
            >
              {d.name}
            </p>
            {d.isReferenceData && (
              <span className="inline-block mt-0.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                Ref Data
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {d.totalFieldCount} {d.totalFieldCount === 1 ? "field" : "fields"}
            </p>
          </div>

          {/* Selected field count badge */}
          {d.isRoot || d.isExpanded ? (
            <div className="flex items-center gap-1 shrink-0">
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">{d.selectedFieldCount}</span>
            </div>
          ) : null}
        </div>

        {d.isRoot && (
          <div className="mt-2 px-2 py-1 bg-primary/10 rounded-md">
            <p className="text-xs text-primary font-medium text-center">Root query type</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const QueryBuilderNode = memo(QueryBuilderNodeComponent);
