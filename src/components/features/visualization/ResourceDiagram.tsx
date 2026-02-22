"use client";

/**
 * ResourceDiagram - Visual Kubernetes Resource Visualization
 *
 * Architecture:
 *   Namespace (GroupNode) → Deployment (GroupNode) → Pod (ResourceNode)
 *
 * Key Design Decisions:
 * - No edges: Uses React Flow sub-flows (nested nodes) for visual grouping
 * - No automatic fitView: Prevents jarring animations on navigation/refresh
 * - Cached translateExtent: Maintains viewport stability during refresh
 * - Position validation: Only shows nodes after layout with valid positions
 *
 * Viewport Behavior:
 * - defaultViewport: { x: 90, y: 70, zoom: 0.7 } - stable starting point
 * - No fitView on mount or refresh - keeps user's viewport position
 * - translateExtent: Limits panning to node bounds + padding
 *
 * Anti-Flicker Patterns:
 * 1. Don't reset layoutCalculated on refresh - keep old nodes visible
 * 2. Check (position.x !== 0 || position.y !== 0) before showing nodes
 * 3. Cache translateExtent to prevent viewport jumps
 *
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

import { useDiagramStore, type LODLevel } from "@/lib/stores/diagram-store";
import { useLayout } from "@/lib/hooks/useLayout";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { ResourceNode, type ResourceNodeData } from "./nodes/ResourceNode";
import { DotNode, type DotNodeData } from "./nodes/DotNode";
import { GroupNode, type GroupNodeData } from "./nodes/GroupNode";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import type { GraphNodeStatus } from "@/lib/types";
import { DiagramToolbar } from "./DiagramToolbar";
import { DiagramLegend } from "./DiagramLegend";

// Define node data types for React Flow
type FlowNodeData = Record<string, unknown> &
  (ResourceNodeData | DotNodeData | GroupNodeData);

// Node types for React Flow
const nodeTypes = {
  resource: ResourceNode,
  dot: DotNode,
  group: GroupNode,
} as const;

function ResourceDiagramInner() {
  const { currentNamespace, isConnected } = useClusterStore();
  const { resolvedTheme } = useUIStore();
  const {
    nodes: storeNodes,
    edges: storeEdges,
    isLoading,
    error,
    lodLevel,
    selectedNodeId,
    highlightedNodeIds,
    visibleNodeTypes,
    fetchGraph,
    setNodePositionsAndSizes,
    setLODLevel,
    setSelectedNode,
    setSearchQuery,
  } = useDiagramStore();

  // Map resolved theme to React Flow colorMode
  const colorMode = resolvedTheme === "light" ? "light" : "dark";

  const { calculatePositions, isCalculating } = useLayout();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(
    []
  );
  const [edges, , onEdgesChange] = useEdgesState<Edge>([]);
  const [searchInput, setSearchInput] = useState("");
  const [zoom, setZoom] = useState(1);
  // Cache the last valid translateExtent to prevent jumps during refresh
  const [cachedExtent, setCachedExtent] = useState<
    [[number, number], [number, number]]
  >([
    [-1500, -1000],
    [2000, 2000],
  ]);

  // Default viewport - reasonable starting point, no automatic fitView
  const defaultViewport = useMemo(() => ({ x: 90, y: 70, zoom: 0.7 }), []);

  // Throttled zoom tracking to reduce re-renders during pan/zoom
  const lastZoomRef = useRef(1);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle viewport changes - throttled to reduce lag
  const onViewportChange = useCallback((viewport: Viewport) => {
    const zoomDiff = Math.abs(viewport.zoom - lastZoomRef.current);
    if (zoomDiff < 0.05) return;

    if (zoomTimeoutRef.current) return;

    zoomTimeoutRef.current = setTimeout(() => {
      lastZoomRef.current = viewport.zoom;
      setZoom(viewport.zoom);
      zoomTimeoutRef.current = null;
    }, 100);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, []);

  // Determine LOD level based on zoom — computed during render
  const currentLod: LODLevel =
    zoom >= 0.8 ? "high" : zoom >= 0.4 ? "medium" : "low";
  if (currentLod !== lodLevel) {
    setLODLevel(currentLod);
  }

  // Track if we need to recalculate layout
  const [layoutCalculated, setLayoutCalculated] = useState(false);
  const prevNodeCountRef = useRef(0);
  const prevEdgeCountRef = useRef(0);

  // Refresh handler — clears nodes and refetches graph
  const handleRefresh = useCallback(() => {
    if (isConnected) {
      setNodes([]);
      setLayoutCalculated(false);
      prevNodeCountRef.current = 0;
      prevEdgeCountRef.current = 0;
      fetchGraph(currentNamespace || undefined);
    }
  }, [isConnected, currentNamespace, fetchGraph, setNodes]);

  // Refetch on connection or namespace change
  useEffect(() => {
    if (isConnected) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger on connection/namespace change
  }, [isConnected, currentNamespace]);

  // Calculate layout when store nodes change
  useEffect(() => {
    const nodeCount = storeNodes.length;
    const edgeCount = storeEdges.length;

    const needsRecalculation =
      nodeCount !== prevNodeCountRef.current ||
      edgeCount !== prevEdgeCountRef.current ||
      !layoutCalculated;

    if (!needsRecalculation) return;

    prevNodeCountRef.current = nodeCount;
    prevEdgeCountRef.current = edgeCount;

    if (nodeCount === 0) {
      setNodes([]);
      setLayoutCalculated(false);
      return;
    }

    calculatePositions(storeNodes, storeEdges).then(({ positions, sizes }) => {
      if (positions.size > 0) {
        setNodePositionsAndSizes(positions, sizes);
        setLayoutCalculated(true);
      }
    });
  }, [
    storeNodes,
    storeEdges,
    calculatePositions,
    setNodePositionsAndSizes,
    setNodes,
    layoutCalculated,
  ]);

  // Convert store nodes to React Flow nodes
  const flowNodes = useMemo(() => {
    const filteredNodes = storeNodes.filter((node) =>
      visibleNodeTypes.has(node.node_type)
    );

    const nodeMap = new Map(storeNodes.map((n) => [n.id, n]));

    const getNodeNamespace = (node: (typeof storeNodes)[0]): string => {
      if (node.node_type === "namespace") {
        return node.name;
      }
      let current = node;
      while (current.parent_id) {
        const parent = nodeMap.get(current.parent_id);
        if (!parent) break;
        if (parent.node_type === "namespace") {
          return parent.name;
        }
        current = parent;
      }
      return node.name;
    };

    const sortedNodes = [...filteredNodes].sort((a, b) => {
      const order = { namespace: 0, deployment: 1, pod: 2 };
      const aOrder = order[a.node_type as keyof typeof order] ?? 3;
      const bOrder = order[b.node_type as keyof typeof order] ?? 3;
      return aOrder - bOrder;
    });

    return sortedNodes.map((node) => {
      const isHighlighted = highlightedNodeIds.has(node.id);
      const isSelected = selectedNodeId === node.id;
      const namespace = getNodeNamespace(node);

      let nodeType: "group" | "resource" | "dot";
      let data: FlowNodeData;

      if (node.is_group) {
        nodeType = "group";
        data = {
          name: node.name,
          nodeType: node.node_type,
          namespace,
          status: node.status,
          childCount: node.child_count,
          isHighlighted,
          isSelected,
        };
      } else if (lodLevel === "low") {
        nodeType = "dot";
        data = {
          name: node.name,
          status: node.status,
          isHighlighted,
          isSelected,
        };
      } else {
        nodeType = "resource";
        data = {
          name: node.name,
          nodeType: node.node_type,
          namespace,
          status: node.status,
          readyStatus: node.ready_status,
          replicas: node.replicas,
          isHighlighted,
          isSelected,
        };
      }

      const style = node.is_group
        ? { width: node.width || 200, height: node.height || 100 }
        : undefined;

      const parentId = node.parent_id || undefined;

      return {
        id: node.id,
        type: nodeType,
        position: node.position,
        data,
        style,
        parentId,
        ...(parentId && { extent: "parent" as const }),
      };
    });
  }, [storeNodes, lodLevel, visibleNodeTypes, highlightedNodeIds, selectedNodeId]);

  // Calculate translate extent based on node positions
  useEffect(() => {
    if (!layoutCalculated || flowNodes.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const node of flowNodes) {
      if (!node.parentId && (node.position.x !== 0 || node.position.y !== 0)) {
        const x = node.position.x;
        const y = node.position.y;
        const width = (node.style?.width as number) || 200;
        const height = (node.style?.height as number) || 100;

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + width);
        maxY = Math.max(maxY, y + height);
      }
    }

    if (minX === Infinity) return;

    setCachedExtent([
      [minX - 1500, minY - 1000],
      [maxX + 500, maxY + 1000],
    ]);
  }, [flowNodes, layoutCalculated]);

  // Sync flow nodes to React Flow state after layout
  useEffect(() => {
    if (layoutCalculated && flowNodes.length > 0) {
      const topLevelNodes = flowNodes.filter((n) => !n.parentId);
      const hasValidPositions = topLevelNodes.some(
        (n) => n.position.x !== 0 || n.position.y !== 0
      );

      if (hasValidPositions || topLevelNodes.length === 0) {
        setNodes(flowNodes);
      }
    } else if (flowNodes.length === 0) {
      setNodes([]);
    }
  }, [flowNodes, setNodes, layoutCalculated]);

  // Handle search with debounce
  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      const timeout = setTimeout(() => {
        setSearchQuery(value);
      }, 300);
      return () => clearTimeout(timeout);
    },
    [setSearchQuery]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id === selectedNodeId ? null : node.id);
    },
    [selectedNodeId, setSelectedNode]
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

  if (error) {
    return (
      <Card className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-destructive">{error}</p>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="mr-2 size-4" />
          Retry
        </Button>
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

      {/* React Flow Canvas */}
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
