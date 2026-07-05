import { create } from "zustand";
import type { GraphNode, GraphEdge, GraphData } from "../types";
import { type KubeliError, toKubeliError } from "../types/errors";
import { generateResourceGraph } from "../tauri/commands";

// Extended node data for React Flow (includes position)
export interface DiagramNode extends GraphNode {
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

interface DiagramState {
  // Graph data
  nodes: DiagramNode[];
  edges: GraphEdge[];

  // UI state
  isLoading: boolean;
  error: KubeliError | null;
  selectedNodeId: string | null;
  searchQuery: string;
  highlightedNodeIds: Set<string>;

  // Filters
  visibleNodeTypes: Set<string>;

  // Actions
  fetchGraph: (namespaces?: string[]) => Promise<void>;
  setNodePositionsAndSizes: (
    positions: Map<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>
  ) => void;
  setSelectedNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleNodeTypeFilter: (nodeType: string) => void;
  resetFilters: () => void;
  clearGraph: () => void;
}

// Simplified: only core workload hierarchy
const ALL_NODE_TYPES = new Set(["namespace", "deployment", "pod"]);

export const useDiagramStore = create<DiagramState>((set, get) => ({
  nodes: [],
  edges: [],
  isLoading: false,
  error: null,
  selectedNodeId: null,
  searchQuery: "",
  highlightedNodeIds: new Set(),
  visibleNodeTypes: new Set(ALL_NODE_TYPES),

  fetchGraph: async (namespaces?: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const data: GraphData = await generateResourceGraph(namespaces ?? []);

      // Carry over known positions/sizes by ID so a refresh keeps the old
      // layout on screen instead of blanking; new nodes start at (0,0) until
      // the layout worker places them.
      const prevById = new Map(get().nodes.map((n) => [n.id, n]));
      const diagramNodes: DiagramNode[] = data.nodes.map((node) => {
        const prev = prevById.get(node.id);
        return {
          ...node,
          position: prev?.position ?? { x: 0, y: 0 },
          width: prev?.width,
          height: prev?.height,
        };
      });

      // Surface partial errors from RBAC-restricted API calls
      const error = data.errors.length > 0
        ? {
            kind: "Forbidden" as const,
            message: "Some resources could not be loaded due to access restrictions",
            suggestions: ["Check RBAC role assignments for your user", "Configure accessible namespaces in the sidebar"],
            retryable: true,
            detail: data.errors.join("\n"),
          }
        : null;

      set({
        nodes: diagramNodes,
        edges: data.edges,
        isLoading: false,
        error,
      });
    } catch (e) {
      set({
        error: toKubeliError(e),
        isLoading: false,
      });
    }
  },

  setNodePositionsAndSizes: (
    positions: Map<string, { x: number; y: number }>,
    sizes: Map<string, { width: number; height: number }>
  ) => {
    const { nodes } = get();

    // Update positions and sizes from layout worker
    const updatedNodes = nodes.map((node) => {
      const pos = positions.get(node.id);
      const size = sizes.get(node.id);

      return {
        ...node,
        position: pos || node.position,
        width: size?.width || node.width,
        height: size?.height || node.height,
      };
    });

    set({ nodes: updatedNodes });
  },

  setSelectedNode: (nodeId: string | null) => {
    set({ selectedNodeId: nodeId });
  },

  setSearchQuery: (query: string) => {
    const { nodes } = get();
    const lowerQuery = query.toLowerCase();

    if (!query) {
      set({ searchQuery: "", highlightedNodeIds: new Set() });
      return;
    }

    const matchingIds = new Set(
      nodes
        .filter((node) => node.name.toLowerCase().includes(lowerQuery))
        .map((node) => node.id)
    );

    set({ searchQuery: query, highlightedNodeIds: matchingIds });
  },

  toggleNodeTypeFilter: (nodeType: string) => {
    const { visibleNodeTypes } = get();
    const newTypes = new Set(visibleNodeTypes);

    if (newTypes.has(nodeType)) {
      newTypes.delete(nodeType);
    } else {
      newTypes.add(nodeType);
    }

    set({ visibleNodeTypes: newTypes });
  },

  resetFilters: () => {
    set({
      visibleNodeTypes: new Set(ALL_NODE_TYPES),
      searchQuery: "",
      highlightedNodeIds: new Set(),
    });
  },

  clearGraph: () => {
    set({
      nodes: [],
      edges: [],
      error: null,
      selectedNodeId: null,
      searchQuery: "",
      highlightedNodeIds: new Set(),
    });
  },
}));
