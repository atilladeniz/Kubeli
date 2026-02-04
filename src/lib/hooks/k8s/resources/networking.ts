"use client";

import {
  listServices,
  listIngresses,
  listEndpointSlices,
  listNetworkPolicies,
  listIngressClasses,
} from "../../../tauri/commands";
import type {
  ServiceInfo,
  IngressInfo,
  EndpointSliceInfo,
  NetworkPolicyInfo,
  IngressClassInfo,
} from "../../../types";
import { createListOptionsHook, createClusterScopedHook } from "../factory";

/**
 * Hook for fetching Services.
 */
export const useServices = createListOptionsHook<ServiceInfo>("Services", listServices);

/**
 * Hook for fetching Ingresses.
 */
export const useIngresses = createListOptionsHook<IngressInfo>("Ingresses", listIngresses);

/**
 * Hook for fetching EndpointSlices.
 */
export const useEndpointSlices = createListOptionsHook<EndpointSliceInfo>(
  "Endpoint Slices",
  listEndpointSlices
);

/**
 * Hook for fetching NetworkPolicies.
 */
export const useNetworkPolicies = createListOptionsHook<NetworkPolicyInfo>(
  "Network Policies",
  listNetworkPolicies
);

/**
 * Hook for fetching IngressClasses (cluster-scoped).
 */
export const useIngressClasses = createClusterScopedHook<IngressClassInfo>(
  "Ingress Classes",
  async () => listIngressClasses({})
);
