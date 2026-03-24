import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { QueryBuilderNode, type QueryBuilderNodeData } from "./QueryBuilderNode";
import type { SchemaSnapshot } from "@/lib/apiClient";
import type { QueryBuilderState } from "@/graphql/queryBuilder";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 208;
const NODE_HEIGHT = 110;

const nodeTypes = { queryBuilderNode: QueryBuilderNode };

// ---------------------------------------------------------------------------
// Dagre layout — positions computed once on mount / when templates change
// ---------------------------------------------------------------------------

function buildDagreLayout(snapshot: SchemaSnapshot): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  snapshot.templates.forEach((t) => {
    g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  // Use schema relationships to inform layout
  snapshot.templates.forEach((tpl) => {
    tpl.relationships.forEach((rel) => {
      if (rel.fromTemplateId === tpl.id) {
        if (g.hasNode(rel.fromTemplateId) && g.hasNode(rel.toTemplateId)) {
          g.setEdge(rel.fromTemplateId, rel.toTemplateId);
        }
      }
    });
  });

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  snapshot.templates.forEach((t) => {
    const node = g.node(t.id);
    if (node) {
      positions[t.id] = {
        x: node.x - NODE_WIDTH / 2,
        y: node.y - NODE_HEIGHT / 2,
      };
    }
  });
  return positions;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QueryBuilderCanvasProps {
  snapshot: SchemaSnapshot;
  state: QueryBuilderState;
  onSetRoot: (templateId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueryBuilderCanvas({ snapshot, state, onSetRoot }: QueryBuilderCanvasProps) {
  const initialPositions = useMemo(() => buildDagreLayout(snapshot), [snapshot]);

  // Build initial nodes from snapshot
  const makeNodes = useCallback((): Node[] => {
    return snapshot.templates.map((tpl) => {
      const pos = initialPositions[tpl.id] ?? { x: 0, y: 0 };
      const selected = state.selectedFields[tpl.id] ?? new Set<string>();
      const totalFieldCount = tpl.sections.reduce((acc, s) => acc + s.attributes.length, 0);
      const isRoot = state.rootTemplateId === tpl.id;

      // A node is "expanded" if any expanded relationship targets it
      const rootTpl = snapshot.templates.find((t) => t.id === state.rootTemplateId);
      const isExpanded = rootTpl
        ? state.expandedRelIds.some((relId) => {
            const rel = rootTpl.relationships.find((r) => r.id === relId);
            return rel?.toTemplateId === tpl.id;
          })
        : false;

      const nodeData: QueryBuilderNodeData = {
        name: tpl.name,
        isReferenceData: tpl.isReferenceData,
        totalFieldCount,
        selectedFieldCount: selected.size,
        isRoot,
        isExpanded,
        onSetRoot,
      };

      return {
        id: tpl.id,
        type: "queryBuilderNode",
        position: pos,
        data: nodeData as Record<string, unknown>,
        draggable: true,
        selectable: false,
      };
    });
  }, [snapshot, state, onSetRoot, initialPositions]);

  // Build edges — only for expanded relationships (not all schema rels)
  const makeEdges = useCallback((): Edge[] => {
    if (!state.rootTemplateId) return [];
    const rootTpl = snapshot.templates.find((t) => t.id === state.rootTemplateId);
    if (!rootTpl) return [];

    return state.expandedRelIds.flatMap((relId) => {
      const rel = rootTpl.relationships.find((r) => r.id === relId);
      if (!rel) return [];
      return [
        {
          id: `qb-edge-${relId}`,
          source: rel.fromTemplateId,
          target: rel.toTemplateId,
          type: "default",
          style: { stroke: "hsl(var(--primary))", strokeWidth: 2, strokeDasharray: "6 3" },
          animated: true,
        },
      ];
    });
  }, [snapshot, state]);

  const [nodes, setNodes, onNodesChange] = useNodesState(makeNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(makeEdges());

  // Re-sync nodes/edges when state changes (without resetting drag positions)
  const prevStateRef = useRef(state);
  useEffect(() => {
    prevStateRef.current = state;
    setNodes((prev) => {
      const next = makeNodes();
      // Preserve drag positions
      const posMap = new Map(prev.map((n) => [n.id, n.position]));
      return next.map((n) => ({ ...n, position: posMap.get(n.id) ?? n.position }));
    });
    setEdges(makeEdges());
  }, [state, makeNodes, makeEdges, setNodes, setEdges]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={true}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={true}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="opacity-40" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}
