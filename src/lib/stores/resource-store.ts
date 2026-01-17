import { create } from "zustand";
import type {
  PodInfo,
  DeploymentInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  NodeInfo,
  ListOptions,
} from "../types";
import {
  listPods,
  listDeployments,
  listServices,
  listConfigmaps,
  listSecrets,
  listNodes,
  getPod,
  deletePod,
} from "../tauri/commands";

interface ResourceState {
  pods: PodInfo[];
  deployments: DeploymentInfo[];
  services: ServiceInfo[];
  configmaps: ConfigMapInfo[];
  secrets: SecretInfo[];
  nodes: NodeInfo[];
  selectedPod: PodInfo | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPods: (options?: ListOptions) => Promise<void>;
  fetchDeployments: (options?: ListOptions) => Promise<void>;
  fetchServices: (options?: ListOptions) => Promise<void>;
  fetchConfigmaps: (options?: ListOptions) => Promise<void>;
  fetchSecrets: (options?: ListOptions) => Promise<void>;
  fetchNodes: () => Promise<void>;
  fetchAllResources: (namespace?: string) => Promise<void>;
  selectPod: (name: string, namespace: string) => Promise<void>;
  removePod: (name: string, namespace: string) => Promise<void>;
  clearResources: () => void;
  setError: (error: string | null) => void;
}

export const useResourceStore = create<ResourceState>((set, get) => ({
  pods: [],
  deployments: [],
  services: [],
  configmaps: [],
  secrets: [],
  nodes: [],
  selectedPod: null,
  isLoading: false,
  error: null,

  fetchPods: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const pods = await listPods(options);
      set({ pods, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch pods",
        isLoading: false,
      });
    }
  },

  fetchDeployments: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const deployments = await listDeployments(options);
      set({ deployments, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch deployments",
        isLoading: false,
      });
    }
  },

  fetchServices: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const services = await listServices(options);
      set({ services, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch services",
        isLoading: false,
      });
    }
  },

  fetchConfigmaps: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const configmaps = await listConfigmaps(options);
      set({ configmaps, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch configmaps",
        isLoading: false,
      });
    }
  },

  fetchSecrets: async (options = {}) => {
    set({ isLoading: true, error: null });
    try {
      const secrets = await listSecrets(options);
      set({ secrets, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch secrets",
        isLoading: false,
      });
    }
  },

  fetchNodes: async () => {
    set({ isLoading: true, error: null });
    try {
      const nodes = await listNodes();
      set({ nodes, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch nodes",
        isLoading: false,
      });
    }
  },

  fetchAllResources: async (namespace) => {
    set({ isLoading: true, error: null });
    const options: ListOptions = namespace ? { namespace } : {};
    try {
      const [pods, deployments, services, configmaps, secrets, nodes] =
        await Promise.all([
          listPods(options),
          listDeployments(options),
          listServices(options),
          listConfigmaps(options),
          listSecrets(options),
          listNodes(),
        ]);
      set({
        pods,
        deployments,
        services,
        configmaps,
        secrets,
        nodes,
        isLoading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch resources",
        isLoading: false,
      });
    }
  },

  selectPod: async (name, namespace) => {
    set({ isLoading: true, error: null });
    try {
      const pod = await getPod(name, namespace);
      set({ selectedPod: pod, isLoading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch pod details",
        isLoading: false,
      });
    }
  },

  removePod: async (name, namespace) => {
    set({ isLoading: true, error: null });
    try {
      await deletePod(name, namespace);
      // Refresh pods list
      const currentPods = get().pods;
      set({
        pods: currentPods.filter(
          (p) => !(p.name === name && p.namespace === namespace)
        ),
        isLoading: false,
      });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to delete pod",
        isLoading: false,
      });
    }
  },

  clearResources: () =>
    set({
      pods: [],
      deployments: [],
      services: [],
      configmaps: [],
      secrets: [],
      nodes: [],
      selectedPod: null,
      error: null,
    }),

  setError: (error) => set({ error }),
}));
