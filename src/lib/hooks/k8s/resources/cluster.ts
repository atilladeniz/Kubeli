"use client";

import { listNodes, listNamespaces, listEvents, listLeases } from "../../../tauri/commands";
import type { NodeInfo, NamespaceInfo, EventInfo, LeaseInfo } from "../../../types";
import { createClusterScopedHook, createNamespacedHook } from "../factory";

/**
 * Hook for fetching Nodes (cluster-scoped).
 */
export const useNodes = createClusterScopedHook<NodeInfo>("Nodes", listNodes);

/**
 * Hook for fetching Namespaces (cluster-scoped).
 */
export const useNamespaces = createClusterScopedHook<NamespaceInfo>(
  "Namespaces",
  listNamespaces
);

/**
 * Hook for fetching Events.
 * Events have a faster default refresh interval (10s) and are sorted by timestamp.
 */
export const useEvents = createNamespacedHook<EventInfo>({
  displayName: "Events",
  listFn: listEvents,
  defaultRefreshInterval: 10000,
  postProcess: (events) => {
    // Sort by last timestamp (most recent first)
    return [...events].sort((a, b) => {
      const timeA = a.last_timestamp || a.created_at || "";
      const timeB = b.last_timestamp || b.created_at || "";
      return timeB.localeCompare(timeA);
    });
  },
});

/**
 * Hook for fetching Leases.
 */
export const useLeases = createNamespacedHook<LeaseInfo>({
  displayName: "Leases",
  listFn: listLeases,
});
