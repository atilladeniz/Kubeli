import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { useDiagramStore } from "@/lib/stores/diagram-store";
import { useLayout } from "@/lib/hooks/useLayout";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { ResourceNodeData } from "./nodes/ResourceNode";
import type { GroupNodeData } from "./nodes/GroupNode";

type FlowNodeData = Record<string, unknown> & (ResourceNodeData | GroupNodeData);
type FlowNode = Node<FlowNodeData>;

const DEFAULT_EXTENT: [[number, number], [number, number]] = [
  [-1500, -1000],
  [2000, 2000],
];

type StoreNodes = ReturnType<typeof useDiagramStore.getState>["nodes"];

/**
 * Layout is a function of the graph topology (who exists, who is nested in
 * whom), not of node status. Status-only refreshes must not trigger an ELK
 * pass — that's what caused relayouts on every poll.
 */
function topologySignature(storeNodes: StoreNodes): string {
  return storeNodes
    .map((n) => `${n.id}:${n.parent_id ?? ""}:${n.node_type}:${n.is_group}`)
    .sort()
    .join("|");
}

/**
 * Manages diagram layout lifecycle:
 * - Watches connection/namespace changes and triggers refresh
 * - Calculates ELK layout (in a Web Worker) when the topology changes
 * - Converts store nodes to React Flow nodes with per-ID object caching so
 *   unchanged nodes keep their reference and memoized node components skip
 * - Caches translate extent for viewport stability
 */
export function useDiagramLayout(
  setNodes: (nodes: FlowNode[]) => void,
) {
  const selectedNamespaces = useClusterStore((s) => s.selectedNamespaces);
  const isConnected = useClusterStore((s) => s.isConnected);
  const storeNodes = useDiagramStore((s) => s.nodes);
  const storeEdges = useDiagramStore((s) => s.edges);
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId);
  const highlightedNodeIds = useDiagramStore((s) => s.highlightedNodeIds);
  const visibleNodeTypes = useDiagramStore((s) => s.visibleNodeTypes);
  const fetchGraph = useDiagramStore((s) => s.fetchGraph);
  const setNodePositionsAndSizes = useDiagramStore((s) => s.setNodePositionsAndSizes);

  const { calculatePositions, isCalculating } = useLayout();

  const [cachedExtent, setCachedExtent] = useState(DEFAULT_EXTENT);
  const prevSignatureRef = useRef<string | null>(null);
  // Track layout completion — ref avoids cascading renders from synchronous setState in effects
  const layoutReadyRef = useRef(false);
  // Counter to trigger re-evaluation of dependent memos/effects after layout
  const [layoutVersion, setLayoutVersion] = useState(0);
  // Per-ID cache of built flow nodes for reference stability
  const nodeCacheRef = useRef(new Map<string, { key: string; node: FlowNode }>());

  // Refresh: refetch only. Old nodes stay on screen (store carries positions
  // over by ID) and the layout only reruns if the topology actually changed.
  const handleRefresh = useCallback(() => {
    if (!isConnected) return;
    fetchGraph(selectedNamespaces);
  }, [isConnected, selectedNamespaces, fetchGraph]);

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
          // Different content — here a blank slate is correct
          setNodes([]);
          nodeCacheRef.current.clear();
          layoutReadyRef.current = false;
          prevSignatureRef.current = null;
          fetchGraph(state.selectedNamespaces);
        });
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  // Calculate layout when the topology changes
  useEffect(() => {
    if (storeNodes.length === 0) {
      setNodes([]);
      nodeCacheRef.current.clear();
      layoutReadyRef.current = false;
      prevSignatureRef.current = null;
      return;
    }

    const signature = topologySignature(storeNodes);
    if (signature === prevSignatureRef.current && layoutReadyRef.current) {
      return;
    }
    prevSignatureRef.current = signature;

    calculatePositions(storeNodes, storeEdges).then(({ positions, sizes }) => {
      // Empty result = stale/failed request (useLayout token guard) — ignore
      if (positions.size > 0) {
        setNodePositionsAndSizes(positions, sizes);
        layoutReadyRef.current = true;
        // Bump version to trigger dependent memos to re-evaluate
        setLayoutVersion((v) => v + 1);
      }
    });
  }, [storeNodes, storeEdges, calculatePositions, setNodePositionsAndSizes, setNodes]);

  // Convert store nodes to React Flow nodes (cached per ID)
  const flowNodes = useMemo(
    () =>
      buildNodes(
        storeNodes,
        visibleNodeTypes,
        highlightedNodeIds,
        selectedNodeId,
        nodeCacheRef.current,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layoutVersion triggers rebuild after positions update
    [storeNodes, visibleNodeTypes, highlightedNodeIds, selectedNodeId, layoutVersion],
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
    isCalculating,
    cachedExtent,
  };
}

// Pure function to build React Flow nodes from store nodes. Reuses the cached
// node object when nothing visible changed, so React Flow's memoized node
// components bail out on reference equality.
function buildNodes(
  storeNodes: StoreNodes,
  visibleNodeTypes: Set<string>,
  highlightedNodeIds: Set<string>,
  selectedNodeId: string | null,
  cache: Map<string, { key: string; node: FlowNode }>,
) {
  const filteredNodes = storeNodes.filter((node) =>
    visibleNodeTypes.has(node.node_type),
  );

  const nodeMap = new Map(storeNodes.map((n) => [n.id, n]));

  const getNodeNamespace = (node: StoreNodes[0]): string => {
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

  const seen = new Set<string>();
  const result = sortedNodes.map((node) => {
    seen.add(node.id);
    const isHighlighted = highlightedNodeIds.has(node.id);
    const isSelected = selectedNodeId === node.id;
    const namespace = getNodeNamespace(node);
    const parentId = node.parent_id || undefined;

    // Everything the built node depends on; cache hit = same reference out
    const cacheKey = [
      node.name,
      node.node_type,
      namespace,
      node.status,
      node.ready_status ?? "",
      node.replicas ?? "",
      node.child_count ?? "",
      node.is_group,
      node.position.x,
      node.position.y,
      node.width ?? "",
      node.height ?? "",
      parentId ?? "",
      isHighlighted,
      isSelected,
    ].join(" ");

    const cached = cache.get(node.id);
    if (cached && cached.key === cacheKey) {
      return cached.node;
    }

    let nodeType: "group" | "resource";
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
    } else {
      // Always use ResourceNode — contextual zoom handles compact vs full view
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

    const built: FlowNode = {
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
    cache.set(node.id, { key: cacheKey, node: built });
    return built;
  });

  // Drop cache entries for nodes that no longer exist
  if (cache.size > seen.size) {
    for (const id of cache.keys()) {
      if (!seen.has(id)) cache.delete(id);
    }
  }

  return result;
}
