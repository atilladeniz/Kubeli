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
 * Hook for fetching Deployments.
 */
export const useDeployments = createListOptionsHook<DeploymentInfo>(
  "Deployments",
  listDeployments
);

/**
 * Hook for fetching ReplicaSets.
 */
export const useReplicaSets = createListOptionsHook<ReplicaSetInfo>(
  "ReplicaSets",
  listReplicasets
);

/**
 * Hook for fetching DaemonSets.
 */
export const useDaemonSets = createListOptionsHook<DaemonSetInfo>(
  "DaemonSets",
  listDaemonsets
);

/**
 * Hook for fetching StatefulSets.
 */
export const useStatefulSets = createListOptionsHook<StatefulSetInfo>(
  "StatefulSets",
  listStatefulsets
);

/**
 * Hook for fetching Jobs.
 */
export const useJobs = createListOptionsHook<JobInfo>("Jobs", listJobs);

/**
 * Hook for fetching CronJobs.
 */
export const useCronJobs = createListOptionsHook<CronJobInfo>("CronJobs", listCronjobs);
