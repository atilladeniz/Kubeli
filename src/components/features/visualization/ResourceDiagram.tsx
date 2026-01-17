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
 * - defaultViewport: { x: 50, y: 50, zoom: 0.55 } - stable starting point
 * - No fitView on mount or refresh - keeps user's viewport position
 * - translateExtent: Limits panning to node bounds + 500px padding
 *
 * Anti-Flicker Patterns:
 * 1. Don't reset layoutCalculated on refresh - keep old nodes visible
 * 2. Check (position.x !== 0 || position.y !== 0) before showing nodes
 * 3. Cache translateExtent to prevent viewport jumps
 *
 * @see CLAUDE.md for full documentation
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphNodeStatus } from "@/lib/types";

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
  const t = useTranslations("diagram");
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
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [searchInput, setSearchInput] = useState("");
  const [zoom, setZoom] = useState(1);
  // Cache the last valid translateExtent to prevent jumps during refresh
  // Left/top has more padding to allow symmetric panning (viewport origin is top-left)
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
    // Only update if zoom changed significantly (LOD thresholds)
    const zoomDiff = Math.abs(viewport.zoom - lastZoomRef.current);
    if (zoomDiff < 0.05) return; // Ignore small changes

    // Throttle updates
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

  // Determine LOD level based on zoom
  useEffect(() => {
    let newLod: LODLevel;
    if (zoom >= 0.8) {
      newLod = "high";
    } else if (zoom >= 0.4) {
      newLod = "medium";
    } else {
      newLod = "low";
    }
    if (newLod !== lodLevel) {
      setLODLevel(newLod);
    }
  }, [zoom, lodLevel, setLODLevel]);

  // Track if we need to recalculate layout
  const [layoutCalculated, setLayoutCalculated] = useState(false);
  const prevNodeCountRef = useRef(0);
  const prevEdgeCountRef = useRef(0);

  // Manual refresh handler (for refresh button)
  const handleRefresh = useCallback(() => {
    if (isConnected) {
      // Reset layout tracking to trigger recalculation
      setLayoutCalculated(false);
      prevNodeCountRef.current = 0;
      prevEdgeCountRef.current = 0;
      fetchGraph(currentNamespace || undefined);
    }
  }, [isConnected, currentNamespace, fetchGraph]);

  // Fetch when connected or namespace changes
  useEffect(() => {
    if (isConnected) {
      // Clear current nodes immediately when namespace changes
      setNodes([]);
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only trigger on connection/namespace change
  }, [isConnected, currentNamespace]);

  // Calculate layout when store nodes change (but not when positions update)
  useEffect(() => {
    const nodeCount = storeNodes.length;
    const edgeCount = storeEdges.length;

    // Check if we need to recalculate:
    // - Node or edge count changed
    // - Layout hasn't been calculated yet
    // - Refs were reset (refresh scenario)
    const needsRecalculation =
      nodeCount !== prevNodeCountRef.current ||
      edgeCount !== prevEdgeCountRef.current ||
      !layoutCalculated;

    if (!needsRecalculation) {
      return;
    }

    prevNodeCountRef.current = nodeCount;
    prevEdgeCountRef.current = edgeCount;

    async function layout() {
      if (nodeCount === 0) {
        setNodes([]);
        setEdges([]);
        setLayoutCalculated(false);
        return;
      }

      const { positions, sizes } = await calculatePositions(
        storeNodes,
        storeEdges
      );

      if (positions.size > 0) {
        setNodePositionsAndSizes(positions, sizes);
        setLayoutCalculated(true);
      }
    }
    layout();
  }, [
    storeNodes,
    storeEdges,
    calculatePositions,
    setNodePositionsAndSizes,
    setNodes,
    setEdges,
    layoutCalculated,
  ]);

  // Convert store nodes to React Flow nodes
  // IMPORTANT: Parent nodes (groups) must come before their children in the correct order
  const flowNodes = useMemo(() => {
    const filteredNodes = storeNodes.filter((node) =>
      visibleNodeTypes.has(node.node_type)
    );

    // Build a map of node id -> node for parent lookups
    const nodeMap = new Map(storeNodes.map((n) => [n.id, n]));

    // Helper to get namespace for a node
    const getNodeNamespace = (node: (typeof storeNodes)[0]): string => {
      if (node.node_type === "namespace") {
        return node.name;
      }
      // For deployments and pods, traverse up to find the namespace
      let current = node;
      while (current.parent_id) {
        const parent = nodeMap.get(current.parent_id);
        if (!parent) break;
        if (parent.node_type === "namespace") {
          return parent.name;
        }
        current = parent;
      }
      return node.name; // Fallback to node name
    };

    // Sort nodes: namespaces first, then deployments, then pods
    // This ensures parent nodes come before children
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

      // Determine node type based on whether it's a group and LOD level
      let nodeType: "group" | "resource" | "dot";
      let data: FlowNodeData;

      if (node.is_group) {
        // Namespace and Deployment nodes are group nodes
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
        // Low LOD uses dot nodes
        nodeType = "dot";
        data = {
          name: node.name,
          status: node.status,
          isHighlighted,
          isSelected,
        };
      } else {
        // Regular resource nodes (pods)
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

      // Use calculated width/height for group nodes (from store)
      const style = node.is_group
        ? {
            width: node.width || 200,
            height: node.height || 100,
          }
        : undefined;

      // For child nodes, set parentId for React Flow sub-flows
      const parentId = node.parent_id || undefined;

      return {
        id: node.id,
        type: nodeType,
        position: node.position,
        data,
        style,
        // Sub-flow configuration
        parentId,
        // Constrain children to parent bounds
        ...(parentId && {
          extent: "parent" as const,
        }),
      };
    });
  }, [
    storeNodes,
    lodLevel,
    visibleNodeTypes,
    highlightedNodeIds,
    selectedNodeId,
  ]);

  // No edges - sub-flows provide visual grouping
  const flowEdges = useMemo(() => [], []);

  // Calculate translate extent to limit panning based on node positions
  // Updates cached value when layout is ready with valid positions
  useEffect(() => {
    // Only update when layout is ready and we have nodes
    if (!layoutCalculated || flowNodes.length === 0) {
      return;
    }

    // Find bounds of all top-level nodes (namespaces)
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const node of flowNodes) {
      // Only consider top-level nodes with valid positions (not at 0,0)
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

    // If no valid bounds found, keep cached extent
    if (minX === Infinity) {
      return;
    }

    // Add generous padding around the bounds
    // Left/top needs more padding because translateExtent limits viewport origin (top-left corner)
    // To allow symmetric panning, left padding should account for viewport size
    const paddingLeft = 1500;
    const paddingTop = 1000;
    const paddingRight = 500;
    const paddingBottom = 1000;
    const newExtent: [[number, number], [number, number]] = [
      [minX - paddingLeft, minY - paddingTop],
      [maxX + paddingRight, maxY + paddingBottom],
    ];

    setCachedExtent(newExtent);
  }, [flowNodes, layoutCalculated]);

  // Update React Flow nodes/edges when flow nodes/edges change
  // Only show nodes after layout is calculated to prevent flicker
  useEffect(() => {
    if (layoutCalculated && flowNodes.length > 0) {
      // Extra check: only update if top-level nodes have valid positions
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
    // Keep showing old nodes while new layout is calculating
  }, [flowNodes, setNodes, layoutCalculated]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  // Handle search
  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      // Debounce
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
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder={t("searchResources")}
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isCalculating}
        >
          <RefreshCw
            className={cn(
              "size-4",
              (isLoading || isCalculating) && "animate-spin"
            )}
          />
        </Button>

        <div className="flex items-center gap-1 ml-auto">
          <Badge variant="secondary" className="text-xs">
            {t("nodes", { count: storeNodes.length })}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {t("edges", { count: storeEdges.length })}
          </Badge>
        </div>
      </div>

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

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-3 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-green-500" />
          <span>{t("healthy")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-yellow-500" />
          <span>{t("warning")}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-red-500" />
          <span>{t("error")}</span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-muted-foreground">
            {t("hierarchy")}
          </span>
        </div>
      </div>
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
