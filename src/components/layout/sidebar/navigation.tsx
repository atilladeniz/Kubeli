"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpDown,
  Box,
  Clock,
  Copy,
  Database,
  FileText,
  Gauge,
  GitBranch,
  Globe,
  HardDrive,
  Hexagon,
  KeyRound,
  Layers,
  LayoutDashboard,
  Link,
  Monitor,
  Network,
  Package,
  PieChart,
  Play,
  Plug,
  Puzzle,
  Rocket,
  Server,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Timer,
  UserCircle,
  Users,
  Webhook,
  Wrench,
  FolderOpen,
  Archive,
  CircuitBoard,
  BadgeCheck,
  Crown,
  ShieldAlert,
} from "lucide-react";

import type { NavSection } from "./types/types";

const iconClass = "size-3.5 shrink-0";

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
          { id: "cluster-overview", label: t("overview"), icon: <LayoutDashboard className={iconClass} /> },
          { id: "resource-diagram", label: t("resourceDiagram"), icon: <Network className={iconClass} /> },
          { id: "nodes", label: t("nodes"), icon: <Server className={iconClass} /> },
          { id: "events", label: t("events"), icon: <Activity className={iconClass} /> },
          { id: "namespaces", label: t("namespaces"), icon: <Layers className={iconClass} /> },
          { id: "leases", label: t("leases"), icon: <Timer className={iconClass} /> },
        ],
      },
      {
        id: "helm",
        title: t("helm"),
        icon: <Package className="size-4" />,
        items: [{ id: "helm-releases", label: t("releases"), icon: <Package className={iconClass} /> }],
      },
      {
        id: "flux",
        title: "Flux",
        icon: <GitBranch className="size-4" />,
        items: [{ id: "flux-kustomizations", label: "Kustomizations", icon: <GitBranch className={iconClass} /> }],
      },
      {
        id: "argocd",
        title: "ArgoCD",
        icon: <GitBranch className="size-4" />,
        items: [{ id: "argocd-applications", label: t("applications") }],
      },
      {
        id: "workloads",
        title: t("workloads"),
        icon: <Box className="size-4" />,
        items: [
          { id: "workloads-overview", label: t("overview"), icon: <LayoutDashboard className={iconClass} /> },
          { id: "deployments", label: t("deployments"), icon: <Rocket className={iconClass} /> },
          { id: "pods", label: t("pods"), icon: <Hexagon className={iconClass} /> },
          { id: "replicasets", label: t("replicaSets"), icon: <Copy className={iconClass} /> },
          { id: "daemonsets", label: t("daemonSets"), icon: <Monitor className={iconClass} /> },
          { id: "statefulsets", label: t("statefulSets"), icon: <Database className={iconClass} /> },
          { id: "jobs", label: t("jobs"), icon: <Play className={iconClass} /> },
          { id: "cronjobs", label: t("cronJobs"), icon: <Clock className={iconClass} /> },
        ],
      },
      {
        id: "networking",
        title: t("networking"),
        icon: <Globe className="size-4" />,
        items: [
          { id: "port-forwards", label: t("portForwards"), icon: <ArrowRightLeft className={iconClass} /> },
          { id: "services", label: t("services"), icon: <Globe className={iconClass} /> },
          { id: "ingresses", label: t("ingresses"), icon: <ArrowDownToLine className={iconClass} /> },
          { id: "endpoint-slices", label: t("endpointSlices"), icon: <Plug className={iconClass} /> },
          { id: "network-policies", label: t("networkPolicies"), icon: <ShieldCheck className={iconClass} /> },
          { id: "ingress-classes", label: t("ingressClasses"), icon: <Tag className={iconClass} /> },
        ],
      },
      {
        id: "configuration",
        title: t("configuration"),
        icon: <SlidersHorizontal className="size-4" />,
        items: [
          { id: "secrets", label: t("secrets"), icon: <KeyRound className={iconClass} /> },
          { id: "configmaps", label: t("configMaps"), icon: <FileText className={iconClass} /> },
          { id: "hpa", label: t("hpa"), icon: <Gauge className={iconClass} /> },
          { id: "limit-ranges", label: t("limitRanges"), icon: <SlidersHorizontal className={iconClass} /> },
          { id: "resource-quotas", label: t("resourceQuotas"), icon: <PieChart className={iconClass} /> },
          { id: "pod-disruption-budgets", label: t("podDisruptionBudgets"), icon: <ShieldAlert className={iconClass} /> },
        ],
      },
      {
        id: "storage",
        title: t("storage"),
        icon: <Database className="size-4" />,
        items: [
          { id: "persistent-volumes", label: t("persistentVolumes"), icon: <HardDrive className={iconClass} /> },
          {
            id: "persistent-volume-claims",
            label: t("persistentVolumeClaims"),
            icon: <FolderOpen className={iconClass} />,
          },
          { id: "volume-attachments", label: t("volumeAttachments"), icon: <Link className={iconClass} /> },
          { id: "storage-classes", label: t("storageClasses"), icon: <Archive className={iconClass} /> },
          { id: "csi-drivers", label: t("csiDrivers"), icon: <Plug className={iconClass} /> },
          { id: "csi-nodes", label: t("csiNodes"), icon: <CircuitBoard className={iconClass} /> },
        ],
      },
      {
        id: "access-control",
        title: t("accessControl"),
        icon: <Shield className="size-4" />,
        items: [
          { id: "service-accounts", label: t("serviceAccounts"), icon: <UserCircle className={iconClass} /> },
          { id: "roles", label: t("roles"), icon: <BadgeCheck className={iconClass} /> },
          { id: "role-bindings", label: t("roleBindings"), icon: <Users className={iconClass} /> },
          { id: "cluster-roles", label: t("clusterRoles"), icon: <Crown className={iconClass} /> },
          { id: "cluster-role-bindings", label: t("clusterRoleBindings"), icon: <Shield className={iconClass} /> },
        ],
      },
      {
        id: "administration",
        title: t("administration"),
        icon: <Wrench className="size-4" />,
        items: [
          { id: "crds", label: t("crds"), icon: <Puzzle className={iconClass} /> },
          { id: "priority-classes", label: t("priorityClasses"), icon: <ArrowUpDown className={iconClass} /> },
          { id: "runtime-classes", label: t("runtimeClasses"), icon: <Play className={iconClass} /> },
          { id: "mutating-webhooks", label: t("mutatingWebhooks"), icon: <Webhook className={iconClass} /> },
          { id: "validating-webhooks", label: t("validatingWebhooks"), icon: <Webhook className={iconClass} /> },
        ],
      },
    ],
    [t],
  );
}
