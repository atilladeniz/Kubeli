"use client";

import {
  listServiceAccounts,
  listRoles,
  listRoleBindings,
  listClusterRoles,
  listClusterRoleBindings,
} from "../../../tauri/commands";
import type {
  ServiceAccountInfo,
  RoleInfo,
  RoleBindingInfo,
  ClusterRoleInfo,
  ClusterRoleBindingInfo,
} from "../../../types";
import { createOptionalNamespaceHook, createClusterScopedHook } from "../factory";

/**
 * Hook for fetching ServiceAccounts.
 */
export const useServiceAccounts = createOptionalNamespaceHook<ServiceAccountInfo>(
  "Service Accounts",
  listServiceAccounts
);

/**
 * Hook for fetching Roles.
 */
export const useRoles = createOptionalNamespaceHook<RoleInfo>("Roles", listRoles);

/**
 * Hook for fetching RoleBindings.
 */
export const useRoleBindings = createOptionalNamespaceHook<RoleBindingInfo>(
  "Role Bindings",
  listRoleBindings
);

/**
 * Hook for fetching ClusterRoles (cluster-scoped).
 */
export const useClusterRoles = createClusterScopedHook<ClusterRoleInfo>(
  "Cluster Roles",
  listClusterRoles
);

/**
 * Hook for fetching ClusterRoleBindings (cluster-scoped).
 */
export const useClusterRoleBindings = createClusterScopedHook<ClusterRoleBindingInfo>(
  "Cluster Role Bindings",
  listClusterRoleBindings
);
