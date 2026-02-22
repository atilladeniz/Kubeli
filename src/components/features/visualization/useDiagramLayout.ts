import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { useDiagramStore, type LODLevel } from "@/lib/stores/diagram-store";
import { useLayout } from "@/lib/hooks/useLayout";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ResourceNodeData } from "./nodes/ResourceNode";
import type { DotNodeData } from "./nodes/DotNode";
import type { GroupNodeData } from "./nodes/GroupNode";

type FlowNodeData = Record<string, unknown> &
  (ResourceNodeData | DotNodeData | GroupNodeData);

const DEFAULT_EXTENT: [[number, number], [number, number]] = [
  [-1500, -1000],
  [2000, 2000],
];

/**
 * Manages diagram layout lifecycle:
 * - Watches connection/namespace changes and triggers refresh
 * - Calculates ELK layout when store nodes change
 * - Converts store nodes to React Flow nodes with LOD support
 * - Caches translate extent for viewport stability
 */
export function useDiagramLayout(
  setNodes: (nodes: Node<FlowNodeData>[]) => void,
) {
  const { selectedNamespaces, isConnected } = useClusterStore();
  const {
    nodes: storeNodes,
    edges: storeEdges,
    lodLevel,
    selectedNodeId,
    highlightedNodeIds,
    visibleNodeTypes,
    fetchGraph,
    setNodePositionsAndSizes,
    setLODLevel,
  } = useDiagramStore();

  const { calculatePositions, isCalculating } = useLayout();

  const [cachedExtent, setCachedExtent] = useState(DEFAULT_EXTENT);
  const prevNodeCountRef = useRef(0);
  const prevEdgeCountRef = useRef(0);
  // Track layout completion — ref avoids cascading renders from synchronous setState in effects
  const layoutReadyRef = useRef(false);
  // Counter to trigger re-evaluation of dependent memos/effects after layout
  const [layoutVersion, setLayoutVersion] = useState(0);

  // LOD level based on zoom — set from parent via callback
  const updateLODFromZoom = useCallback(
    (zoom: number) => {
      const lod: LODLevel =
        zoom >= 0.8 ? "high" : zoom >= 0.4 ? "medium" : "low";
      if (lod !== lodLevel) {
        setLODLevel(lod);
      }
    },
    [lodLevel, setLODLevel],
  );

  // Refresh: clear nodes, reset layout tracking, refetch
  const handleRefresh = useCallback(() => {
    if (!isConnected) return;
    setNodes([]);
    layoutReadyRef.current = false;
    prevNodeCountRef.current = 0;
    prevEdgeCountRef.current = 0;
    fetchGraph(selectedNamespaces);
  }, [isConnected, selectedNamespaces, fetchGraph, setNodes]);

  // Initial fetch on mount + watch connection/namespace changes
  useEffect(() => {
    const { isConnected: connected, selectedNamespaces: nsList } =
      useClusterStore.getState();
    if (connected && storeNodes.length === 0) {
      fetchGraph(nsList);
    }

    let prevNsList = nsList;
    let prevConnected = connected;

    const unsub = useClusterStore.subscribe((state) => {
      const nsChanged = state.selectedNamespaces !== prevNsList;
      const connChanged = state.isConnected !== prevConnected;
      prevNsList = state.selectedNamespaces;
      prevConnected = state.isConnected;

      if (state.isConnected && (nsChanged || connChanged)) {
        queueMicrotask(() => {
          setNodes([]);
          layoutReadyRef.current = false;
          prevNodeCountRef.current = 0;
          prevEdgeCountRef.current = 0;
          fetchGraph(state.selectedNamespaces);
        });
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  // Calculate layout when store nodes change
  useEffect(() => {
    const nodeCount = storeNodes.length;
    const edgeCount = storeEdges.length;

    const needsRecalculation =
      nodeCount !== prevNodeCountRef.current ||
      edgeCount !== prevEdgeCountRef.current ||
      !layoutReadyRef.current;

    if (!needsRecalculation) return;

    prevNodeCountRef.current = nodeCount;
    prevEdgeCountRef.current = edgeCount;

    if (nodeCount === 0) {
      setNodes([]);
      layoutReadyRef.current = false;
      return;
    }

    calculatePositions(storeNodes, storeEdges).then(({ positions, sizes }) => {
      if (positions.size > 0) {
        setNodePositionsAndSizes(positions, sizes);
        layoutReadyRef.current = true;
        // Bump version to trigger dependent memos to re-evaluate
        setLayoutVersion((v) => v + 1);
      }
    });
  }, [storeNodes, storeEdges, calculatePositions, setNodePositionsAndSizes, setNodes]);

  // Convert store nodes to React Flow nodes
  const flowNodes = useMemo(
    () =>
      buildNodes(
        storeNodes,
        lodLevel,
        visibleNodeTypes,
        highlightedNodeIds,
        selectedNodeId,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutVersion triggers rebuild after positions update
    [storeNodes, lodLevel, visibleNodeTypes, highlightedNodeIds, selectedNodeId, layoutVersion],
  );

  // Compute translate extent — derived from flowNodes, keeps last valid value
  const computedExtent = useMemo((): [[number, number], [number, number]] | null => {
    if (flowNodes.length === 0) return null;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const node of flowNodes) {
      if (!node.parentId) {
        const w = (node.style?.width as number) || 200;
        const h = (node.style?.height as number) || 100;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + w);
        maxY = Math.max(maxY, node.position.y + h);
      }
    }

    if (minX === Infinity) return null;

    return [
      [minX - 1500, minY - 1000],
      [maxX + 500, maxY + 1000],
    ];
  }, [flowNodes]);

  // Update cached extent only when we have a valid new extent
  useEffect(() => {
    if (computedExtent) {
      setCachedExtent(computedExtent);
    }
  }, [computedExtent]);

  // Sync flow nodes to React Flow after layout
  useEffect(() => {
    if (layoutReadyRef.current && flowNodes.length > 0) {
      setNodes(flowNodes);
    } else if (flowNodes.length === 0) {
      setNodes([]);
    }
  }, [flowNodes, setNodes]);

  return {
    handleRefresh,
    updateLODFromZoom,
    isCalculating,
    cachedExtent,
  };
}

// Pure function to build React Flow nodes from store nodes
function buildNodes(
  storeNodes: ReturnType<typeof useDiagramStore.getState>["nodes"],
  lodLevel: LODLevel,
  visibleNodeTypes: Set<string>,
  highlightedNodeIds: Set<string>,
  selectedNodeId: string | null,
) {
  const filteredNodes = storeNodes.filter((node) =>
    visibleNodeTypes.has(node.node_type),
  );

  const nodeMap = new Map(storeNodes.map((n) => [n.id, n]));

  const getNodeNamespace = (node: (typeof storeNodes)[0]): string => {
    if (node.node_type === "namespace") return node.name;
    let current = node;
    while (current.parent_id) {
      const parent = nodeMap.get(current.parent_id);
      if (!parent) break;
      if (parent.node_type === "namespace") return parent.name;
      current = parent;
    }
    return node.name;
  };

  const sortedNodes = [...filteredNodes].sort((a, b) => {
    const order = { namespace: 0, deployment: 1, pod: 2 };
    return (
      (order[a.node_type as keyof typeof order] ?? 3) -
      (order[b.node_type as keyof typeof order] ?? 3)
    );
  });

  return sortedNodes.map((node) => {
    const isHighlighted = highlightedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const namespace = getNodeNamespace(node);
    const parentId = node.parent_id || undefined;

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

    return {
      id: node.id,
      type: nodeType,
      position: node.position,
      data,
      style: node.is_group
        ? { width: node.width || 200, height: node.height || 100 }
        : undefined,
      parentId,
      ...(parentId && { extent: "parent" as const }),
    };
  });
}
