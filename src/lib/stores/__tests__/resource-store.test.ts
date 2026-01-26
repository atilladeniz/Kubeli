import { act } from "@testing-library/react";
import { useResourceStore } from "../resource-store";

// Mock Tauri commands
const mockListPods = jest.fn();
const mockListDeployments = jest.fn();
const mockListServices = jest.fn();
const mockListConfigmaps = jest.fn();
const mockListSecrets = jest.fn();
const mockListNodes = jest.fn();
const mockGetPod = jest.fn();
const mockDeletePod = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listPods: (options?: unknown) => mockListPods(options),
  listDeployments: (options?: unknown) => mockListDeployments(options),
  listServices: (options?: unknown) => mockListServices(options),
  listConfigmaps: (options?: unknown) => mockListConfigmaps(options),
  listSecrets: (options?: unknown) => mockListSecrets(options),
  listNodes: () => mockListNodes(),
  getPod: (name: string, namespace: string) => mockGetPod(name, namespace),
  deletePod: (name: string, namespace: string) => mockDeletePod(name, namespace),
}));

// Test data
const mockPods = [
  { name: "nginx-1", namespace: "default", status: "Running" },
  { name: "nginx-2", namespace: "default", status: "Running" },
];

const mockDeployments = [
  { name: "nginx", namespace: "default", replicas: 2, ready_replicas: 2 },
];

const mockServices = [
  { name: "nginx-svc", namespace: "default", type: "ClusterIP", cluster_ip: "10.0.0.1" },
];

const mockConfigmaps = [
  { name: "app-config", namespace: "default", data_count: 3 },
];

const mockSecrets = [
  { name: "app-secret", namespace: "default", type: "Opaque" },
];

const mockNodes = [
  { name: "node-1", status: "Ready", roles: ["control-plane"] },
  { name: "node-2", status: "Ready", roles: ["worker"] },
];

describe("ResourceStore", () => {
  beforeEach(() => {
    // Reset store state
    useResourceStore.setState({
      pods: [],
      deployments: [],
      services: [],
      configmaps: [],
      secrets: [],
      nodes: [],
      selectedPod: null,
      isLoading: false,
      error: null,
    });

    jest.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have empty resource arrays", () => {
      const state = useResourceStore.getState();
      expect(state.pods).toEqual([]);
      expect(state.deployments).toEqual([]);
      expect(state.services).toEqual([]);
      expect(state.configmaps).toEqual([]);
      expect(state.secrets).toEqual([]);
      expect(state.nodes).toEqual([]);
    });

    it("should have no selected pod", () => {
      expect(useResourceStore.getState().selectedPod).toBeNull();
    });

    it("should not be loading", () => {
      expect(useResourceStore.getState().isLoading).toBe(false);
    });
  });

  describe("fetchPods", () => {
    it("should fetch and set pods", async () => {
      mockListPods.mockResolvedValue(mockPods);

      await act(async () => {
        await useResourceStore.getState().fetchPods();
      });

      expect(useResourceStore.getState().pods).toEqual(mockPods);
      expect(useResourceStore.getState().isLoading).toBe(false);
    });

    it("should pass options to list command", async () => {
      mockListPods.mockResolvedValue(mockPods);

      await act(async () => {
        await useResourceStore.getState().fetchPods({ namespace: "kube-system" });
      });

      expect(mockListPods).toHaveBeenCalledWith({ namespace: "kube-system" });
    });

    it("should handle fetch error", async () => {
      mockListPods.mockRejectedValue(new Error("Connection refused"));

      await act(async () => {
        await useResourceStore.getState().fetchPods();
      });

      expect(useResourceStore.getState().error).toBe("Connection refused");
      expect(useResourceStore.getState().pods).toEqual([]);
    });
  });

  describe("fetchDeployments", () => {
    it("should fetch and set deployments", async () => {
      mockListDeployments.mockResolvedValue(mockDeployments);

      await act(async () => {
        await useResourceStore.getState().fetchDeployments();
      });

      expect(useResourceStore.getState().deployments).toEqual(mockDeployments);
    });

    it("should handle fetch error", async () => {
      mockListDeployments.mockRejectedValue(new Error("API error"));

      await act(async () => {
        await useResourceStore.getState().fetchDeployments();
      });

      expect(useResourceStore.getState().error).toBe("API error");
    });
  });

  describe("fetchServices", () => {
    it("should fetch and set services", async () => {
      mockListServices.mockResolvedValue(mockServices);

      await act(async () => {
        await useResourceStore.getState().fetchServices();
      });

      expect(useResourceStore.getState().services).toEqual(mockServices);
    });
  });

  describe("fetchConfigmaps", () => {
    it("should fetch and set configmaps", async () => {
      mockListConfigmaps.mockResolvedValue(mockConfigmaps);

      await act(async () => {
        await useResourceStore.getState().fetchConfigmaps();
      });

      expect(useResourceStore.getState().configmaps).toEqual(mockConfigmaps);
    });
  });

  describe("fetchSecrets", () => {
    it("should fetch and set secrets", async () => {
      mockListSecrets.mockResolvedValue(mockSecrets);

      await act(async () => {
        await useResourceStore.getState().fetchSecrets();
      });

      expect(useResourceStore.getState().secrets).toEqual(mockSecrets);
    });
  });

  describe("fetchNodes", () => {
    it("should fetch and set nodes", async () => {
      mockListNodes.mockResolvedValue(mockNodes);

      await act(async () => {
        await useResourceStore.getState().fetchNodes();
      });

      expect(useResourceStore.getState().nodes).toEqual(mockNodes);
    });
  });

  describe("fetchAllResources", () => {
    beforeEach(() => {
      mockListPods.mockResolvedValue(mockPods);
      mockListDeployments.mockResolvedValue(mockDeployments);
      mockListServices.mockResolvedValue(mockServices);
      mockListConfigmaps.mockResolvedValue(mockConfigmaps);
      mockListSecrets.mockResolvedValue(mockSecrets);
      mockListNodes.mockResolvedValue(mockNodes);
    });

    it("should fetch all resources", async () => {
      await act(async () => {
        await useResourceStore.getState().fetchAllResources();
      });

      const state = useResourceStore.getState();
      expect(state.pods).toEqual(mockPods);
      expect(state.deployments).toEqual(mockDeployments);
      expect(state.services).toEqual(mockServices);
      expect(state.configmaps).toEqual(mockConfigmaps);
      expect(state.secrets).toEqual(mockSecrets);
      expect(state.nodes).toEqual(mockNodes);
      expect(state.isLoading).toBe(false);
    });

    it("should pass namespace option to all resource fetches", async () => {
      await act(async () => {
        await useResourceStore.getState().fetchAllResources("monitoring");
      });

      expect(mockListPods).toHaveBeenCalledWith({ namespace: "monitoring" });
      expect(mockListDeployments).toHaveBeenCalledWith({ namespace: "monitoring" });
      expect(mockListServices).toHaveBeenCalledWith({ namespace: "monitoring" });
      expect(mockListConfigmaps).toHaveBeenCalledWith({ namespace: "monitoring" });
      expect(mockListSecrets).toHaveBeenCalledWith({ namespace: "monitoring" });
    });

    it("should handle partial failure", async () => {
      mockListPods.mockRejectedValue(new Error("Pods fetch failed"));

      await act(async () => {
        await useResourceStore.getState().fetchAllResources();
      });

      expect(useResourceStore.getState().error).toBe("Pods fetch failed");
    });
  });

  describe("selectPod", () => {
    const mockPodDetails = {
      name: "nginx-1",
      namespace: "default",
      status: "Running",
      containers: [{ name: "nginx", image: "nginx:latest" }],
    };

    it("should select and fetch pod details", async () => {
      mockGetPod.mockResolvedValue(mockPodDetails);

      await act(async () => {
        await useResourceStore.getState().selectPod("nginx-1", "default");
      });

      expect(mockGetPod).toHaveBeenCalledWith("nginx-1", "default");
      expect(useResourceStore.getState().selectedPod).toEqual(mockPodDetails);
    });

    it("should handle select error", async () => {
      mockGetPod.mockRejectedValue(new Error("Pod not found"));

      await act(async () => {
        await useResourceStore.getState().selectPod("invalid", "default");
      });

      expect(useResourceStore.getState().error).toBe("Pod not found");
      expect(useResourceStore.getState().selectedPod).toBeNull();
    });
  });

  describe("removePod", () => {
    beforeEach(() => {
      useResourceStore.setState({ pods: mockPods });
    });

    it("should delete pod and remove from list", async () => {
      mockDeletePod.mockResolvedValue(undefined);

      await act(async () => {
        await useResourceStore.getState().removePod("nginx-1", "default");
      });

      expect(mockDeletePod).toHaveBeenCalledWith("nginx-1", "default");
      const pods = useResourceStore.getState().pods;
      expect(pods).toHaveLength(1);
      expect(pods[0].name).toBe("nginx-2");
    });

    it("should handle delete error", async () => {
      mockDeletePod.mockRejectedValue(new Error("Permission denied"));

      await act(async () => {
        await useResourceStore.getState().removePod("nginx-1", "default");
      });

      expect(useResourceStore.getState().error).toBe("Permission denied");
      // Pods should remain unchanged
      expect(useResourceStore.getState().pods).toEqual(mockPods);
    });
  });

  describe("clearResources", () => {
    beforeEach(() => {
      useResourceStore.setState({
        pods: mockPods,
        deployments: mockDeployments,
        services: mockServices,
        configmaps: mockConfigmaps,
        secrets: mockSecrets,
        nodes: mockNodes,
        selectedPod: mockPods[0],
        error: "Some error",
      });
    });

    it("should clear all resources", () => {
      act(() => {
        useResourceStore.getState().clearResources();
      });

      const state = useResourceStore.getState();
      expect(state.pods).toEqual([]);
      expect(state.deployments).toEqual([]);
      expect(state.services).toEqual([]);
      expect(state.configmaps).toEqual([]);
      expect(state.secrets).toEqual([]);
      expect(state.nodes).toEqual([]);
      expect(state.selectedPod).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe("setError", () => {
    it("should set error message", () => {
      act(() => {
        useResourceStore.getState().setError("Custom error");
      });

      expect(useResourceStore.getState().error).toBe("Custom error");
    });

    it("should clear error when set to null", () => {
      useResourceStore.setState({ error: "Previous error" });

      act(() => {
        useResourceStore.getState().setError(null);
      });

      expect(useResourceStore.getState().error).toBeNull();
    });
  });
});
