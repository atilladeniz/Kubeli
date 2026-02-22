import { create } from "zustand";
import type { GraphNode, GraphEdge, GraphData } from "../types";
import { generateResourceGraph } from "../tauri/commands";

// Extended node data for React Flow (includes position)
export interface DiagramNode extends GraphNode {
  position: { x: number; y: number };
  width?: number;
  height?: number;
}

// LOD (Level of Detail) levels
export type LODLevel = "high" | "medium" | "low";

interface DiagramState {
  // Graph data
  nodes: DiagramNode[];
  edges: GraphEdge[];

  // UI state
  isLoading: boolean;
  error: string | null;
  lodLevel: LODLevel;
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
  setLODLevel: (level: LODLevel) => void;
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
  lodLevel: "high",
  selectedNodeId: null,
  searchQuery: "",
  highlightedNodeIds: new Set(),
  visibleNodeTypes: new Set(ALL_NODE_TYPES),

  fetchGraph: async (namespaces?: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const data: GraphData = await generateResourceGraph(namespaces ?? []);

      // Convert GraphNodes to DiagramNodes with initial positions (0,0)
      // Layout will be calculated by the Web Worker
      const diagramNodes: DiagramNode[] = data.nodes.map((node) => ({
        ...node,
        position: { x: 0, y: 0 },
      }));

      set({
        nodes: diagramNodes,
        edges: data.edges,
        isLoading: false,
        error: null,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch graph",
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

  setLODLevel: (level: LODLevel) => {
    set({ lodLevel: level });
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
