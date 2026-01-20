"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useClusterStore } from "../stores/cluster-store";
import {
  listPods,
  listDeployments,
  listServices,
  listConfigmaps,
  listSecrets,
  listNodes,
  listNamespaces,
  listEvents,
  listLeases,
  listReplicasets,
  listDaemonsets,
  listStatefulsets,
  listJobs,
  listCronjobs,
  listIngresses,
  listEndpointSlices,
  listNetworkPolicies,
  listIngressClasses,
  listHPAs,
  listLimitRanges,
  listResourceQuotas,
  listPDBs,
  listPersistentVolumes,
  listPersistentVolumeClaims,
  listStorageClasses,
  listCSIDrivers,
  listCSINodes,
  listVolumeAttachments,
  listServiceAccounts,
  listRoles,
  listRoleBindings,
  listClusterRoles,
  listClusterRoleBindings,
  listCRDs,
  listPriorityClasses,
  listRuntimeClasses,
  listMutatingWebhooks,
  listValidatingWebhooks,
  listHelmReleases,
  listFluxKustomizations,
  watchPods,
  stopWatch,
} from "../tauri/commands";
import type {
  PodInfo,
  DeploymentInfo,
  ServiceInfo,
  ConfigMapInfo,
  SecretInfo,
  NodeInfo,
  NamespaceInfo,
  EventInfo,
  LeaseInfo,
  ReplicaSetInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  JobInfo,
  CronJobInfo,
  IngressInfo,
  EndpointSliceInfo,
  NetworkPolicyInfo,
  IngressClassInfo,
  HPAInfo,
  LimitRangeInfo,
  ResourceQuotaInfo,
  PDBInfo,
  PVInfo,
  PVCInfo,
  StorageClassInfo,
  CSIDriverInfo,
  CSINodeInfo,
  VolumeAttachmentInfo,
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
  CRDInfo,
  PriorityClassInfo,
  RuntimeClassInfo,
  MutatingWebhookInfo,
  ValidatingWebhookInfo,
  HelmReleaseInfo,
  FluxKustomizationInfo,
  ListOptions,
  WatchEvent,
} from "../types";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

type ResourceData = {
  pods: PodInfo[];
  deployments: DeploymentInfo[];
  services: ServiceInfo[];
  configmaps: ConfigMapInfo[];
  secrets: SecretInfo[];
  nodes: NodeInfo[];
};

type ResourceType = keyof ResourceData;

interface UseK8sResourcesOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  namespace?: string;
  autoWatch?: boolean; // Auto-start watch on mount (efficient WebSocket-based updates)
}

interface UseK8sResourcesReturn<T> {
  data: T[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startWatch: () => Promise<void>;
  stopWatchFn: () => Promise<void>;
  isWatching: boolean;
}

export function usePods(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<PodInfo> {
  return useK8sResource("pods", listPods, options);
}

export function useDeployments(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<DeploymentInfo> {
  return useK8sResource("deployments", listDeployments, options);
}

export function useServices(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ServiceInfo> {
  return useK8sResource("services", listServices, options);
}

export function useConfigMaps(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ConfigMapInfo> {
  return useK8sResource("configmaps", listConfigmaps, options);
}

export function useSecrets(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<SecretInfo> {
  return useK8sResource("secrets", listSecrets, options);
}

export function useNodes(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<NodeInfo> {
  const [data, setData] = useState<NodeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listNodes();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch nodes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useNamespaces(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<NamespaceInfo> {
  const [data, setData] = useState<NamespaceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listNamespaces();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch namespaces");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useEvents(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<EventInfo> {
  const [data, setData] = useState<EventInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listEvents(listOptions);
      // Sort by last timestamp (most recent first)
      result.sort((a, b) => {
        const timeA = a.last_timestamp || a.created_at || "";
        const timeB = b.last_timestamp || b.created_at || "";
        return timeB.localeCompare(timeA);
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch events");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    // Events should refresh more frequently (every 10 seconds by default)
    const interval = setInterval(refresh, options.refreshInterval || 10000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useLeases(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<LeaseInfo> {
  const [data, setData] = useState<LeaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listLeases(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch leases");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useReplicaSets(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ReplicaSetInfo> {
  const [data, setData] = useState<ReplicaSetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listReplicasets(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch replicasets");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useDaemonSets(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<DaemonSetInfo> {
  const [data, setData] = useState<DaemonSetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listDaemonsets(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch daemonsets");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useStatefulSets(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<StatefulSetInfo> {
  const [data, setData] = useState<StatefulSetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listStatefulsets(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch statefulsets");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useJobs(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<JobInfo> {
  const [data, setData] = useState<JobInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listJobs(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch jobs");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useCronJobs(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<CronJobInfo> {
  const [data, setData] = useState<CronJobInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listCronjobs(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch cronjobs");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// Networking Resources
export function useIngresses(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<IngressInfo> {
  const [data, setData] = useState<IngressInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listIngresses(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch ingresses");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useEndpointSlices(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<EndpointSliceInfo> {
  const [data, setData] = useState<EndpointSliceInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listEndpointSlices(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch endpoint slices");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useNetworkPolicies(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<NetworkPolicyInfo> {
  const [data, setData] = useState<NetworkPolicyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listNetworkPolicies(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch network policies");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useIngressClasses(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<IngressClassInfo> {
  const [data, setData] = useState<IngressClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listIngressClasses({});
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch ingress classes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// Configuration Resources
export function useHPAs(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<HPAInfo> {
  const [data, setData] = useState<HPAInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listHPAs(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch HPAs");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useLimitRanges(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<LimitRangeInfo> {
  const [data, setData] = useState<LimitRangeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listLimitRanges(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch LimitRanges");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useResourceQuotas(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ResourceQuotaInfo> {
  const [data, setData] = useState<ResourceQuotaInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listResourceQuotas(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch ResourceQuotas");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function usePDBs(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<PDBInfo> {
  const [data, setData] = useState<PDBInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await listPDBs(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch PDBs");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// =============================================================================
// Storage Resources
// =============================================================================

export function usePersistentVolumes(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<PVInfo> {
  const [data, setData] = useState<PVInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listPersistentVolumes();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Persistent Volumes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function usePersistentVolumeClaims(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<PVCInfo> {
  const [data, setData] = useState<PVCInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listPersistentVolumeClaims(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Persistent Volume Claims");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useStorageClasses(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<StorageClassInfo> {
  const [data, setData] = useState<StorageClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listStorageClasses();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Storage Classes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useCSIDrivers(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<CSIDriverInfo> {
  const [data, setData] = useState<CSIDriverInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listCSIDrivers();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch CSI Drivers");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useCSINodes(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<CSINodeInfo> {
  const [data, setData] = useState<CSINodeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listCSINodes();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch CSI Nodes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useVolumeAttachments(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<VolumeAttachmentInfo> {
  const [data, setData] = useState<VolumeAttachmentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listVolumeAttachments();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Volume Attachments");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// =============================================================================
// Access Control Resources
// =============================================================================

export function useServiceAccounts(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ServiceAccountInfo> {
  const [data, setData] = useState<ServiceAccountInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listServiceAccounts(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Service Accounts");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useRoles(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<RoleInfo> {
  const [data, setData] = useState<RoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listRoles(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Roles");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useRoleBindings(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<RoleBindingInfo> {
  const [data, setData] = useState<RoleBindingInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listRoleBindings(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Role Bindings");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useClusterRoles(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ClusterRoleInfo> {
  const [data, setData] = useState<ClusterRoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listClusterRoles();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Cluster Roles");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useClusterRoleBindings(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ClusterRoleBindingInfo> {
  const [data, setData] = useState<ClusterRoleBindingInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listClusterRoleBindings();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Cluster Role Bindings");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// =============================================================================
// Administration Resources
// =============================================================================

export function useCRDs(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<CRDInfo> {
  const [data, setData] = useState<CRDInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listCRDs();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch CRDs");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function usePriorityClasses(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<PriorityClassInfo> {
  const [data, setData] = useState<PriorityClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listPriorityClasses();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Priority Classes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useRuntimeClasses(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<RuntimeClassInfo> {
  const [data, setData] = useState<RuntimeClassInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listRuntimeClasses();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Runtime Classes");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useMutatingWebhooks(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<MutatingWebhookInfo> {
  const [data, setData] = useState<MutatingWebhookInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listMutatingWebhooks();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Mutating Webhooks");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

export function useValidatingWebhooks(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<ValidatingWebhookInfo> {
  const [data, setData] = useState<ValidatingWebhookInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useClusterStore();

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listValidatingWebhooks();
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Validating Webhooks");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// Helm Releases hook
export function useHelmReleases(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<HelmReleaseInfo> {
  const [data, setData] = useState<HelmReleaseInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      // Pass namespace if set, otherwise fetch all releases
      const result = await listHelmReleases(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Helm Releases");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

// Flux Kustomizations hook
export function useFluxKustomizations(options: UseK8sResourcesOptions = {}): UseK8sResourcesReturn<FluxKustomizationInfo> {
  const [data, setData] = useState<FluxKustomizationInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await listFluxKustomizations(namespace || undefined);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch Flux Kustomizations");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace]);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  useEffect(() => {
    if (!options.autoRefresh || !isConnected) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch: async () => {},
    stopWatchFn: async () => {},
    isWatching: false,
  };
}

function useK8sResource<T extends PodInfo | DeploymentInfo | ServiceInfo | ConfigMapInfo | SecretInfo>(
  _resourceType: ResourceType,
  fetchFn: (options: ListOptions) => Promise<T[]>,
  options: UseK8sResourcesOptions = {}
): UseK8sResourcesReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [watchId, setWatchId] = useState<string | null>(null);
  const watchRetryUntilRef = useRef<number | null>(null);

  const { isConnected, currentNamespace } = useClusterStore();
  const namespace = options.namespace ?? currentNamespace;

  const refresh = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    setError(null);
    try {
      const listOptions: ListOptions = namespace ? { namespace } : {};
      const result = await fetchFn(listOptions);
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch resources");
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, namespace, fetchFn]);

  const startWatch = useCallback(async () => {
    if (!isConnected || watchId || _resourceType !== "pods") return;

    const id = `${_resourceType}-${Date.now()}`;
    setWatchId(id);
    setError(null);

    try {
      await watchPods(id, namespace || undefined);
      setIsWatching(true);
      watchRetryUntilRef.current = null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start watch");
      setIsWatching(false);
      setWatchId(null);
      watchRetryUntilRef.current = Date.now() + 5000;
    }
  }, [isConnected, watchId, namespace, _resourceType]);

  const stopWatchFn = useCallback(async () => {
    if (!watchId) return;
    try {
      await stopWatch(watchId);
      setIsWatching(false);
      setWatchId(null);
      watchRetryUntilRef.current = null;
    } catch (e) {
      console.error("Failed to stop watch:", e);
    }
  }, [watchId]);

  // Listen for watch events
  useEffect(() => {
    if (!watchId || _resourceType !== "pods") return;

    let unlisten: UnlistenFn;

    const setupListener = async () => {
      unlisten = await listen<WatchEvent<T>>(`pods-watch-${watchId}`, (event) => {
        const watchEvent = event.payload;

        setData((prev) => {
          switch (watchEvent.type) {
            case "Added": {
              const newItem = watchEvent.data as T;
              const index = prev.findIndex(
                (item) => "uid" in item && "uid" in newItem && item.uid === newItem.uid
              );
              if (index === -1) return [...prev, newItem];
              const next = [...prev];
              next[index] = newItem;
              return next;
            }
            case "Modified": {
              const modifiedItem = watchEvent.data as T;
              const index = prev.findIndex(
                (item) => "uid" in item && "uid" in modifiedItem && item.uid === modifiedItem.uid
              );
              if (index === -1) return [...prev, modifiedItem];
              const next = [...prev];
              next[index] = modifiedItem;
              return next;
            }
            case "Deleted": {
              const deletedItem = watchEvent.data as T;
              return prev.filter((item) =>
                !("uid" in item && "uid" in deletedItem && item.uid === deletedItem.uid)
              );
            }
            case "Restarted": {
              return watchEvent.data as T[];
            }
            case "Error": {
              const message =
                typeof watchEvent.data === "string"
                  ? watchEvent.data
                  : "Watch error";
              setError(message);
              setIsWatching(false);
              setWatchId(null);
              watchRetryUntilRef.current = Date.now() + 5000;
              if (watchId) {
                stopWatch(watchId).catch(() => {});
              }
              return prev;
            }
            default:
              return prev;
          }
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [watchId, _resourceType]);

  // Initial fetch
  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  // Auto-refresh
  useEffect(() => {
    if (!options.autoRefresh || !isConnected || isWatching) return;
    const interval = setInterval(refresh, options.refreshInterval || 30000);
    return () => clearInterval(interval);
  }, [options.autoRefresh, options.refreshInterval, isConnected, refresh, isWatching]);

  // Auto-start watch if enabled (more efficient than polling)
  useEffect(() => {
    if (!options.autoWatch || !isConnected || isWatching || watchId || isLoading) return;

    // Small delay to ensure initial data is loaded first
    const retryUntil = watchRetryUntilRef.current;
    const delay =
      retryUntil && retryUntil > Date.now()
        ? retryUntil - Date.now()
        : 500;

    const timer = setTimeout(() => {
      if (_resourceType === "pods") {
        startWatch();
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [options.autoWatch, isConnected, isWatching, isLoading, _resourceType, startWatch]);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId) {
        stopWatch(watchId).catch(console.error);
      }
    };
  }, [watchId]);

  return {
    data,
    isLoading,
    error,
    refresh,
    startWatch,
    stopWatchFn,
    isWatching,
  };
}
