"use client";

import {
  listPods,
  listDeployments,
  listReplicasets,
  listDaemonsets,
  listStatefulsets,
  listJobs,
  listCronjobs,
  watchPods,
  watchDeployments,
  watchReplicasets,
  watchDaemonsets,
  watchStatefulsets,
} from "../../../tauri/commands";
import type {
  PodInfo,
  DeploymentInfo,
  ReplicaSetInfo,
  DaemonSetInfo,
  StatefulSetInfo,
  JobInfo,
  CronJobInfo,
} from "../../../types";
import { createNamespacedHook, createListOptionsHook } from "../factory";

/**
 * Hook for fetching Pods with optional watch support.
 * Pods support real-time updates via WebSocket watching.
 */
export const usePods = createNamespacedHook<PodInfo>({
  displayName: "Pods",
  listFn: listPods,
  supportsWatch: true,
  watchFn: watchPods,
  watchEventPrefix: "pods",
});

/**
 * Hook for fetching Deployments with optional watch support.
 * Deployments support real-time updates via WebSocket watching.
 */
export const useDeployments = createListOptionsHook<DeploymentInfo>(
  "Deployments",
  listDeployments,
  {
    supportsWatch: true,
    watchFn: watchDeployments,
    watchEventPrefix: "deployments",
  }
);

/**
 * Hook for fetching ReplicaSets with optional watch support.
 */
export const useReplicaSets = createListOptionsHook<ReplicaSetInfo>(
  "ReplicaSets",
  listReplicasets,
  {
    supportsWatch: true,
    watchFn: watchReplicasets,
    watchEventPrefix: "replicasets",
  }
);

/**
 * Hook for fetching DaemonSets with optional watch support.
 */
export const useDaemonSets = createListOptionsHook<DaemonSetInfo>(
  "DaemonSets",
  listDaemonsets,
  {
    supportsWatch: true,
    watchFn: watchDaemonsets,
    watchEventPrefix: "daemonsets",
  }
);

/**
 * Hook for fetching StatefulSets with optional watch support.
 */
export const useStatefulSets = createListOptionsHook<StatefulSetInfo>(
  "StatefulSets",
  listStatefulsets,
  {
    supportsWatch: true,
    watchFn: watchStatefulsets,
    watchEventPrefix: "statefulsets",
  }
);

/**
 * Hook for fetching Jobs.
 */
export const useJobs = createListOptionsHook<JobInfo>("Jobs", listJobs);

/**
 * Hook for fetching CronJobs.
 */
export const useCronJobs = createListOptionsHook<CronJobInfo>("CronJobs", listCronjobs);
