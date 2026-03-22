import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { Pencil } from "lucide-react";

export interface RelationshipEdgeData {
  label: string;
  cardinality: "1:1" | "1:N" | "M:N";
  direction: "from" | "to" | "both";
  isLocked: boolean;
  onEdit: (relId: string) => void;
  [key: string]: unknown;
}

const CARDINALITY_LABELS: Record<string, string> = {
  "1:1": "1—1",
  "1:N": "1—N",
  "M:N": "M—N",
};

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const d = data as RelationshipEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const markerEnd = d.direction !== "from" ? "url(#arrow-end)" : undefined;
  const markerStart = d.direction !== "to" ? "url(#arrow-start)" : undefined;

  return (
    <>
      <defs>
        <marker
          id="arrow-end"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
        <marker
          id="arrow-start"
          markerWidth="8"
          markerHeight="8"
          refX="2"
          refY="3"
          orient="auto-start-reverse"
          markerUnits="userSpaceOnUse"
        >
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
        </marker>
      </defs>

      <BaseEdge
        path={edgePath}
        id={id}
        style={{
          stroke: selected ? "hsl(var(--primary))" : "hsl(var(--border))",
          strokeWidth: selected ? 2 : 1.5,
        }}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
          data-testid={`rel-edge-${id}`}
        >
          <div
            className={[
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm border cursor-pointer group/edge transition-all",
              selected
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary hover:bg-primary/5",
            ].join(" ")}
            onClick={() => d.onEdit(id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && d.onEdit(id)}
          >
            <span className="font-mono text-[10px] text-muted-foreground">
              {CARDINALITY_LABELS[d.cardinality] ?? d.cardinality}
            </span>
            <span className="max-w-[120px] truncate" title={d.label}>
              {d.label}
            </span>
            {!d.isLocked && (
              <Pencil className="w-2.5 h-2.5 opacity-0 group-hover/edge:opacity-60 transition-opacity shrink-0" />
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdge = memo(RelationshipEdgeComponent);
