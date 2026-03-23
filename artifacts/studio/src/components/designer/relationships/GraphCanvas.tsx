import { useCallback, useEffect, useRef } from "react";
import {
  ReactFlow,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  ConnectionMode,
  ConnectionLineType,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  Panel,
} from "@xyflow/react";
import { usePermissions } from "@/hooks/usePermissions";
import dagre from "dagre";
import "@xyflow/react/dist/style.css";
import { TemplateNode, type TemplateNodeData } from "./TemplateNode";
import { RelationshipEdge, type RelationshipEdgeData } from "./RelationshipEdge";
import { GraphCanvasToolbar } from "./GraphCanvasToolbar";
import type { CatalogTemplate, RelationshipDefinition, NodePosition } from "@/lib/apiClient";
import { apiClient } from "@/lib/apiClient";
import { useSchemaStore } from "@/stores/schemaStore";
import { useUiStore } from "@/stores/uiStore";

const NODE_WIDTH = 208;
const NODE_HEIGHT = 100;

const nodeTypes = { templateNode: TemplateNode };
const edgeTypes = { relationshipEdge: RelationshipEdge };

function buildDagreLayout(
  templates: CatalogTemplate[],
  relationships: RelationshipDefinition[],
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", ranksep: 120, nodesep: 60 });
  g.setDefaultEdgeLabel(() => ({}));

  templates.forEach((t) => {
    g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  relationships.forEach((r) => {
    if (g.hasNode(r.fromTemplateId) && g.hasNode(r.toTemplateId)) {
      g.setEdge(r.fromTemplateId, r.toTemplateId);
    }
  });

  dagre.layout(g);

  const positions: Record<string, { x: number; y: number }> = {};
  templates.forEach((t) => {
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

function buildFlowElements(
  templates: CatalogTemplate[],
  relationships: RelationshipDefinition[],
  savedPositions: NodePosition[],
  isLocked: boolean,
  catalogId: string,
  onAddRelationship: (templateId: string) => void,
  onEditRelationship: (relId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const posMap = new Map(savedPositions.map((p) => [p.templateId, p]));
  const hasSavedPositions = savedPositions.length > 0;

  const dagrePositions = hasSavedPositions
    ? {}
    : buildDagreLayout(templates, relationships);

  const nodes: Node[] = templates.map((t, i) => {
    const saved = posMap.get(t.id);
    const dagre = dagrePositions[t.id];
    const position = saved
      ? { x: saved.x, y: saved.y }
      : dagre ?? { x: (i % 4) * 280 + 60, y: Math.floor(i / 4) * 160 + 60 };

    return {
      id: t.id,
      type: "templateNode",
      position,
      data: {
        name: t.name,
        sectionCount: t.sectionCount,
        attributeCount: t.attributeCount,
        isReferenceData: t.isReferenceData,
        isLocked,
        catalogId,
        onAddRelationship,
      } satisfies TemplateNodeData,
    };
  });

  const edges: Edge[] = relationships.map((r) => ({
    id: r.id,
    source: r.fromTemplateId,
    target: r.toTemplateId,
    type: "relationshipEdge",
    data: {
      label: r.label,
      cardinality: r.cardinality,
      direction: r.direction,
      isLocked,
      onEdit: onEditRelationship,
    } satisfies RelationshipEdgeData,
  }));

  return { nodes, edges };
}

interface Props {
  catalogId: string;
  templates: CatalogTemplate[];
  relationships: RelationshipDefinition[];
  savedPositions: NodePosition[];
  isLocked: boolean;
}

export function GraphCanvas({ catalogId, templates, relationships, savedPositions, isLocked }: Props) {
  const { fitView } = useReactFlow();
  const { updateNodePositionsLocal } = useSchemaStore();
  const { openCreateRelDrawer, openEditRelDrawer, openDeleteRelModal } = useUiStore();
  const { canEditSchema } = usePermissions(catalogId);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onAddRelationship = useCallback(
    (templateId: string) => {
      openCreateRelDrawer({ fromTemplateId: templateId });
    },
    [openCreateRelDrawer],
  );

  const onEditRelationship = useCallback(
    (relId: string) => {
      if (!isLocked) openEditRelDrawer(relId);
    },
    [isLocked, openEditRelDrawer],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      openCreateRelDrawer({
        fromTemplateId: connection.source!,
        toTemplateId: connection.target!,
      });
    },
    [openCreateRelDrawer],
  );

  const { nodes: initialNodes, edges: initialEdges } = buildFlowElements(
    templates,
    relationships,
    savedPositions,
    isLocked,
    catalogId,
    onAddRelationship,
    onEditRelationship,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Rebuild nodes/edges when data changes (after create/delete/update)
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildFlowElements(
      templates,
      relationships,
      savedPositions,
      isLocked,
      catalogId,
      onAddRelationship,
      onEditRelationship,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [templates, relationships, savedPositions, isLocked]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fit view on first load
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced position save
  function schedulePositionSave(updatedNodes: Node[]) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const positions: NodePosition[] = updatedNodes.map((n) => ({
        templateId: n.id,
        x: n.position.x,
        y: n.position.y,
      }));
      updateNodePositionsLocal(catalogId, positions);
      await apiClient.schema.saveNodePositions(catalogId, positions);
    }, 1000);
  }

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const hasDragStop = changes.some((c) => c.type === "position" && !("dragging" in c && c.dragging));
      if (hasDragStop) {
        setNodes((nds) => {
          schedulePositionSave(nds);
          return nds;
        });
      }
    },
    [onNodesChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  function handleAutoLayout() {
    const positions = buildDagreLayout(templates, relationships);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        position: positions[n.id] ?? n.position,
      })),
    );
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);

    const positionsList: NodePosition[] = Object.entries(positions).map(([templateId, pos]) => ({
      templateId,
      x: pos.x,
      y: pos.y,
    }));
    updateNodePositionsLocal(catalogId, positionsList);
    apiClient.schema.saveNodePositions(catalogId, positionsList);
  }

  async function handleExportPng() {
    const { default: html2canvas } = await import("html2canvas");
    const flowEl = document.querySelector(".react-flow") as HTMLElement | null;
    if (!flowEl) return;

    const canvas = await html2canvas(flowEl, {
      backgroundColor: null,
      useCORS: true,
      scale: 2,
    });

    const link = document.createElement("a");
    link.download = `relationships-${catalogId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes);
    },
    [onEdgesChange],
  );

  return (
    <div className="relative w-full h-full" data-testid="graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={canEditSchema ? handleConnect : undefined}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        connectionLineStyle={{ stroke: "#2563EB", strokeDasharray: "5 5" }}
        connectionLineType={ConnectionLineType.SmoothStep}
        nodesDraggable={!isLocked}
        elementsSelectable
        fitView
        proOptions={{ hideAttribution: true }}
        className="bg-muted/20"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="hsl(var(--border))" />
        <Controls className="!bottom-4 !right-4 !left-auto !top-auto" />
        <MiniMap
          className="!bottom-4 !left-4 !top-auto !right-auto"
          nodeColor="hsl(var(--primary) / 0.15)"
          maskColor="hsl(var(--background) / 0.7)"
        />

        <Panel position="top-left">
          <GraphCanvasToolbar
            isLocked={isLocked}
            onAddRelationship={() => openCreateRelDrawer()}
            onAutoLayout={handleAutoLayout}
            onExportPng={handleExportPng}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
