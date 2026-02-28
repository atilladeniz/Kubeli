"use client";

/**
 * ResourceDiagram - Visual Kubernetes Resource Visualization
 *
 * Architecture:
 *   Namespace (GroupNode) → Deployment (GroupNode) → Pod (ResourceNode)
 *
 * @see useDiagramLayout.ts for layout calculation and node conversion
 * @see DiagramToolbar.tsx for search and refresh controls
 * @see DiagramLegend.tsx for status legend
 * @see CLAUDE.md for full documentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Viewport,
  ConnectionLineType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useDiagramStore } from "@/lib/stores/diagram-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { ResourceNode, type ResourceNodeData } from "./nodes/ResourceNode";
import { DotNode, type DotNodeData } from "./nodes/DotNode";
import { GroupNode, type GroupNodeData } from "./nodes/GroupNode";
import { Card } from "@/components/ui/card";
import { ResourceError } from "@/components/features/resources/ResourceError";
import type { GraphNodeStatus } from "@/lib/types";
import { DiagramToolbar } from "./DiagramToolbar";
import { DiagramLegend } from "./DiagramLegend";
import { useDiagramLayout } from "./useDiagramLayout";

type FlowNodeData = Record<string, unknown> &
  (ResourceNodeData | DotNodeData | GroupNodeData);

const nodeTypes = {
  resource: ResourceNode,
  dot: DotNode,
  group: GroupNode,
} as const;

function ResourceDiagramInner() {
  const { isConnected } = useClusterStore();
  const { resolvedTheme } = useUIStore();
  const {
    nodes: storeNodes,
    edges: storeEdges,
    isLoading,
    error,
    selectedNodeId,
    setSelectedNode,
    setSearchQuery,
  } = useDiagramStore();

  const colorMode = resolvedTheme === "light" ? "light" : "dark";

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>([]);
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const [searchInput, setSearchInput] = useState("");

  const { handleRefresh, updateLODFromZoom, isCalculating, cachedExtent } =
    useDiagramLayout(setNodes);

  const defaultViewport = useMemo(() => ({ x: 90, y: 70, zoom: 0.7 }), []);

  // Throttled zoom tracking
  const lastZoomRef = useRef(1);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onViewportChange = useCallback(
    (viewport: Viewport) => {
      const zoomDiff = Math.abs(viewport.zoom - lastZoomRef.current);
      if (zoomDiff < 0.05 || zoomTimeoutRef.current) return;

      zoomTimeoutRef.current = setTimeout(() => {
        lastZoomRef.current = viewport.zoom;
        updateLODFromZoom(viewport.zoom);
        zoomTimeoutRef.current = null;
      }, 100);
    },
    [updateLODFromZoom],
  );

  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
    };
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      const timeout = setTimeout(() => setSearchQuery(value), 300);
      return () => clearTimeout(timeout);
    },
    [setSearchQuery],
  );

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id === selectedNodeId ? null : node.id);
    },
    [selectedNodeId, setSelectedNode],
  );

  if (!isConnected) {
    return (
      <Card className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">
          Connect to a cluster to view resource diagram
        </p>
      </Card>
    );
  }

  return (
    <Card
      className="flex flex-col overflow-hidden mx-4 mt-4 mb-6"
      style={{ height: "calc(100% - 2.5rem)" }}
    >
      <DiagramToolbar
        searchInput={searchInput}
        onSearch={handleSearch}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        isCalculating={isCalculating}
        nodeCount={storeNodes.length}
        edgeCount={storeEdges.length}
      />

      {error && <ResourceError error={error} onRetry={handleRefresh} />}

      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onViewportChange={onViewportChange}
          nodeTypes={nodeTypes}
          connectionLineType={ConnectionLineType.SmoothStep}
          colorMode={colorMode}
          defaultViewport={defaultViewport}
          minZoom={0.3}
          maxZoom={1.5}
          translateExtent={cachedExtent}
          proOptions={{ hideAttribution: true }}
          zIndexMode="auto"
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          zoomOnDoubleClick={false}
          panOnDrag
          selectionOnDrag={false}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} showFitView={false} />
          <MiniMap
            nodeColor={(node) => {
              const status = (node.data as { status?: GraphNodeStatus }).status;
              switch (status) {
                case "healthy":
                  return "#10b981";
                case "warning":
                  return "#f59e0b";
                case "error":
                  return "#ef4444";
                default:
                  return "#6b7280";
              }
            }}
            maskColor="rgba(0, 0, 0, 0.2)"
            className="bg-card! border rounded-lg"
          />
        </ReactFlow>
      </div>

      <DiagramLegend />
    </Card>
  );
}

export function ResourceDiagram() {
  return (
    <ReactFlowProvider>
      <ResourceDiagramInner />
    </ReactFlowProvider>
  );
}
