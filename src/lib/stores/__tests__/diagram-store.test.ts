import { act } from "@testing-library/react";
import { useDiagramStore, type DiagramNode, type LODLevel } from "../diagram-store";

// Mock Tauri commands
const mockGenerateResourceGraph = jest.fn();

jest.mock("../../tauri/commands", () => ({
  generateResourceGraph: (namespace?: string) => mockGenerateResourceGraph(namespace),
}));

// Test data
const mockGraphData = {
  nodes: [
    { id: "ns-1", name: "default", node_type: "namespace", parent_id: null },
    { id: "deploy-1", name: "nginx", node_type: "deployment", parent_id: "ns-1" },
    { id: "pod-1", name: "nginx-abc123", node_type: "pod", parent_id: "deploy-1" },
    { id: "pod-2", name: "nginx-def456", node_type: "pod", parent_id: "deploy-1" },
  ],
  edges: [
    { source: "ns-1", target: "deploy-1" },
    { source: "deploy-1", target: "pod-1" },
    { source: "deploy-1", target: "pod-2" },
  ],
};

describe("DiagramStore", () => {
  beforeEach(() => {
    // Reset store state
    useDiagramStore.setState({
      nodes: [],
      edges: [],
      isLoading: false,
      error: null,
      lodLevel: "high",
      selectedNodeId: null,
      searchQuery: "",
      highlightedNodeIds: new Set(),
      visibleNodeTypes: new Set(["namespace", "deployment", "pod"]),
    });

    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have empty nodes and edges", () => {
      const state = useDiagramStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
    });

    it("should have high LOD level by default", () => {
      expect(useDiagramStore.getState().lodLevel).toBe("high");
    });

    it("should have all node types visible by default", () => {
      const visibleTypes = useDiagramStore.getState().visibleNodeTypes;
      expect(visibleTypes.has("namespace")).toBe(true);
      expect(visibleTypes.has("deployment")).toBe(true);
      expect(visibleTypes.has("pod")).toBe(true);
    });
  });

  describe("fetchGraph", () => {
    it("should fetch and set graph data", async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);

      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });

      const state = useDiagramStore.getState();
      expect(state.nodes).toHaveLength(4);
      expect(state.edges).toHaveLength(3);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it("should fetch graph for specific namespace", async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);

      await act(async () => {
        await useDiagramStore.getState().fetchGraph("kube-system");
      });

      expect(mockGenerateResourceGraph).toHaveBeenCalledWith("kube-system");
    });

    it("should set loading state while fetching", async () => {
      mockGenerateResourceGraph.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockGraphData), 100))
      );

      const fetchPromise = useDiagramStore.getState().fetchGraph();
      expect(useDiagramStore.getState().isLoading).toBe(true);

      await act(async () => {
        await fetchPromise;
      });

      expect(useDiagramStore.getState().isLoading).toBe(false);
    });

    it("should handle fetch error", async () => {
      mockGenerateResourceGraph.mockRejectedValue(new Error("API error"));

      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });

      const state = useDiagramStore.getState();
      expect(state.error).toBe("API error");
      expect(state.isLoading).toBe(false);
      expect(state.nodes).toEqual([]);
    });

    it("should add position to nodes", async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);

      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });

      const nodes = useDiagramStore.getState().nodes;
      nodes.forEach((node) => {
        expect(node.position).toEqual({ x: 0, y: 0 });
      });
    });
  });

  describe("setNodePositionsAndSizes", () => {
    beforeEach(async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);
      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });
    });

    it("should update node positions", () => {
      const positions = new Map([
        ["ns-1", { x: 100, y: 50 }],
        ["deploy-1", { x: 150, y: 150 }],
      ]);
      const sizes = new Map<string, { width: number; height: number }>();

      act(() => {
        useDiagramStore.getState().setNodePositionsAndSizes(positions, sizes);
      });

      const nodes = useDiagramStore.getState().nodes;
      const ns1 = nodes.find((n) => n.id === "ns-1");
      const deploy1 = nodes.find((n) => n.id === "deploy-1");

      expect(ns1?.position).toEqual({ x: 100, y: 50 });
      expect(deploy1?.position).toEqual({ x: 150, y: 150 });
    });

    it("should update node sizes", () => {
      const positions = new Map<string, { x: number; y: number }>();
      const sizes = new Map([
        ["ns-1", { width: 200, height: 300 }],
        ["pod-1", { width: 100, height: 50 }],
      ]);

      act(() => {
        useDiagramStore.getState().setNodePositionsAndSizes(positions, sizes);
      });

      const nodes = useDiagramStore.getState().nodes;
      const ns1 = nodes.find((n) => n.id === "ns-1");
      const pod1 = nodes.find((n) => n.id === "pod-1");

      expect(ns1?.width).toBe(200);
      expect(ns1?.height).toBe(300);
      expect(pod1?.width).toBe(100);
      expect(pod1?.height).toBe(50);
    });
  });

  describe("setLODLevel", () => {
    it.each<LODLevel>(["high", "medium", "low"])("should set LOD level to %s", (level) => {
      act(() => {
        useDiagramStore.getState().setLODLevel(level);
      });

      expect(useDiagramStore.getState().lodLevel).toBe(level);
    });
  });

  describe("setSelectedNode", () => {
    it("should set selected node", () => {
      act(() => {
        useDiagramStore.getState().setSelectedNode("pod-1");
      });

      expect(useDiagramStore.getState().selectedNodeId).toBe("pod-1");
    });

    it("should clear selected node when set to null", () => {
      useDiagramStore.setState({ selectedNodeId: "pod-1" });

      act(() => {
        useDiagramStore.getState().setSelectedNode(null);
      });

      expect(useDiagramStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe("setSearchQuery", () => {
    beforeEach(async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);
      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });
    });

    it("should set search query and highlight matching nodes", () => {
      act(() => {
        useDiagramStore.getState().setSearchQuery("nginx");
      });

      const state = useDiagramStore.getState();
      expect(state.searchQuery).toBe("nginx");
      expect(state.highlightedNodeIds.size).toBe(3); // nginx, nginx-abc123, nginx-def456
    });

    it("should be case insensitive", () => {
      act(() => {
        useDiagramStore.getState().setSearchQuery("NGINX");
      });

      expect(useDiagramStore.getState().highlightedNodeIds.size).toBe(3);
    });

    it("should clear highlights when query is empty", () => {
      useDiagramStore.setState({
        searchQuery: "nginx",
        highlightedNodeIds: new Set(["deploy-1"]),
      });

      act(() => {
        useDiagramStore.getState().setSearchQuery("");
      });

      const state = useDiagramStore.getState();
      expect(state.searchQuery).toBe("");
      expect(state.highlightedNodeIds.size).toBe(0);
    });
  });

  describe("toggleNodeTypeFilter", () => {
    it("should remove node type from filter", () => {
      act(() => {
        useDiagramStore.getState().toggleNodeTypeFilter("pod");
      });

      const visibleTypes = useDiagramStore.getState().visibleNodeTypes;
      expect(visibleTypes.has("pod")).toBe(false);
      expect(visibleTypes.has("namespace")).toBe(true);
      expect(visibleTypes.has("deployment")).toBe(true);
    });

    it("should add node type back to filter", () => {
      useDiagramStore.setState({
        visibleNodeTypes: new Set(["namespace", "deployment"]),
      });

      act(() => {
        useDiagramStore.getState().toggleNodeTypeFilter("pod");
      });

      expect(useDiagramStore.getState().visibleNodeTypes.has("pod")).toBe(true);
    });
  });

  describe("resetFilters", () => {
    it("should reset all filters to defaults", () => {
      useDiagramStore.setState({
        visibleNodeTypes: new Set(["namespace"]),
        searchQuery: "test",
        highlightedNodeIds: new Set(["pod-1"]),
      });

      act(() => {
        useDiagramStore.getState().resetFilters();
      });

      const state = useDiagramStore.getState();
      expect(state.visibleNodeTypes.size).toBe(3);
      expect(state.searchQuery).toBe("");
      expect(state.highlightedNodeIds.size).toBe(0);
    });
  });

  describe("clearGraph", () => {
    beforeEach(async () => {
      mockGenerateResourceGraph.mockResolvedValue(mockGraphData);
      await act(async () => {
        await useDiagramStore.getState().fetchGraph();
      });
      useDiagramStore.setState({
        selectedNodeId: "pod-1",
        searchQuery: "test",
        highlightedNodeIds: new Set(["pod-1"]),
      });
    });

    it("should clear all graph data", () => {
      act(() => {
        useDiagramStore.getState().clearGraph();
      });

      const state = useDiagramStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.searchQuery).toBe("");
      expect(state.highlightedNodeIds.size).toBe(0);
      expect(state.error).toBeNull();
    });
  });
});
