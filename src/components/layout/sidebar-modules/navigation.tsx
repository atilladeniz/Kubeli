"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Layers,
  Box,
  Globe,
  Settings,
  Database,
  Shield,
  Wrench,
  Package,
  GitBranch,
} from "lucide-react";

import type { NavSection } from "./types";

// Hook to get translated navigation sections
export function useNavigationSections(): NavSection[] {
  const t = useTranslations("navigation");

  return useMemo(
    () => [
      {
        id: "cluster",
        title: t("cluster"),
        icon: <Layers className="size-4" />,
        items: [
          { id: "cluster-overview", label: t("overview") },
          { id: "resource-diagram", label: t("resourceDiagram") },
          { id: "nodes", label: t("nodes") },
          { id: "events", label: t("events") },
          { id: "namespaces", label: t("namespaces") },
          { id: "leases", label: t("leases") },
        ],
      },
      {
        id: "helm",
        title: t("helm"),
        icon: <Package className="size-4" />,
        items: [{ id: "helm-releases", label: t("releases") }],
      },
      {
        id: "flux",
        title: "Flux",
        icon: <GitBranch className="size-4" />,
        items: [{ id: "flux-kustomizations", label: "Kustomizations" }],
      },
      {
        id: "workloads",
        title: t("workloads"),
        icon: <Box className="size-4" />,
        items: [
          { id: "workloads-overview", label: t("overview") },
          { id: "deployments", label: t("deployments") },
          { id: "pods", label: t("pods") },
          { id: "replicasets", label: t("replicaSets") },
          { id: "daemonsets", label: t("daemonSets") },
          { id: "statefulsets", label: t("statefulSets") },
          { id: "jobs", label: t("jobs") },
          { id: "cronjobs", label: t("cronJobs") },
        ],
      },
      {
        id: "networking",
        title: t("networking"),
        icon: <Globe className="size-4" />,
        items: [
          { id: "port-forwards", label: t("portForwards") },
          { id: "services", label: t("services") },
          { id: "ingresses", label: t("ingresses") },
          { id: "endpoint-slices", label: t("endpointSlices") },
          { id: "network-policies", label: t("networkPolicies") },
          { id: "ingress-classes", label: t("ingressClasses") },
        ],
      },
      {
        id: "configuration",
        title: t("configuration"),
        icon: <Settings className="size-4" />,
        items: [
          { id: "secrets", label: t("secrets") },
          { id: "configmaps", label: t("configMaps") },
          { id: "hpa", label: t("hpa") },
          { id: "limit-ranges", label: t("limitRanges") },
          { id: "resource-quotas", label: t("resourceQuotas") },
          { id: "pod-disruption-budgets", label: t("podDisruptionBudgets") },
        ],
      },
      {
        id: "storage",
        title: t("storage"),
        icon: <Database className="size-4" />,
        items: [
          { id: "persistent-volumes", label: t("persistentVolumes") },
          {
            id: "persistent-volume-claims",
            label: t("persistentVolumeClaims"),
          },
          { id: "volume-attachments", label: t("volumeAttachments") },
          { id: "storage-classes", label: t("storageClasses") },
          { id: "csi-drivers", label: t("csiDrivers") },
          { id: "csi-nodes", label: t("csiNodes") },
        ],
      },
      {
        id: "access-control",
        title: t("accessControl"),
        icon: <Shield className="size-4" />,
        items: [
          { id: "service-accounts", label: t("serviceAccounts") },
          { id: "roles", label: t("roles") },
          { id: "role-bindings", label: t("roleBindings") },
          { id: "cluster-roles", label: t("clusterRoles") },
          { id: "cluster-role-bindings", label: t("clusterRoleBindings") },
        ],
      },
      {
        id: "administration",
        title: t("administration"),
        icon: <Wrench className="size-4" />,
        items: [
          { id: "crds", label: t("crds") },
          { id: "priority-classes", label: t("priorityClasses") },
          { id: "runtime-classes", label: t("runtimeClasses") },
          { id: "mutating-webhooks", label: t("mutatingWebhooks") },
          { id: "validating-webhooks", label: t("validatingWebhooks") },
        ],
      },
    ],
    [t]
  );
}
