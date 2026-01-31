"use client";

import type { ResourceType } from "@/components/layout/Sidebar";
import { ResourceDiagram } from "../../visualization";
import { ComingSoon } from "../components";

// Overview views
import { ClusterOverview } from "./ClusterOverview";
import { WorkloadsOverview } from "./WorkloadsOverview";

// Utility views
import { PortForwardsView } from "./PortForwardsView";
import { PodLogsView } from "./PodLogsView";

// Cluster views
import {
  NamespacesView,
  NodesView,
  EventsView,
  LeasesView,
} from "./cluster";

// Workload views
import {
  PodsView,
  DeploymentsView,
  ReplicaSetsView,
  DaemonSetsView,
  StatefulSetsView,
  JobsView,
  CronJobsView,
} from "./workloads";

// Networking views
import {
  ServicesView,
  IngressesView,
  EndpointSlicesView,
  NetworkPoliciesView,
  IngressClassesView,
} from "./networking";

// Config views
import {
  ConfigMapsView,
  SecretsView,
  HPAsView,
  LimitRangesView,
  ResourceQuotasView,
  PDBsView,
} from "./config";

// Storage views
import {
  PersistentVolumesView,
  PersistentVolumeClaimsView,
  StorageClassesView,
  CSIDriversView,
  CSINodesView,
  VolumeAttachmentsView,
} from "./storage";

// RBAC views
import {
  ServiceAccountsView,
  RolesView,
  RoleBindingsView,
  ClusterRolesView,
  ClusterRoleBindingsView,
} from "./rbac";

// Admin views
import {
  CRDsView,
  PriorityClassesView,
  RuntimeClassesView,
  MutatingWebhooksView,
  ValidatingWebhooksView,
} from "./admin";

// GitOps views
import {
  HelmReleasesView,
  FluxKustomizationsView,
} from "./gitops";

interface ResourceViewProps {
  activeResource: ResourceType;
}

export function ResourceView({ activeResource }: ResourceViewProps) {
  switch (activeResource) {
    // Overview
    case "cluster-overview":
      return <ClusterOverview />;
    case "resource-diagram":
      return <ResourceDiagram />;
    case "workloads-overview":
      return <WorkloadsOverview />;

    // Core Resources
    case "pods":
      return <PodsView />;
    case "deployments":
      return <DeploymentsView />;
    case "port-forwards":
      return <PortForwardsView />;
    case "services":
      return <ServicesView />;
    case "configmaps":
      return <ConfigMapsView />;
    case "secrets":
      return <SecretsView />;
    case "nodes":
      return <NodesView />;
    case "namespaces":
      return <NamespacesView />;
    case "events":
      return <EventsView />;
    case "leases":
      return <LeasesView />;

    // Workloads
    case "replicasets":
      return <ReplicaSetsView />;
    case "daemonsets":
      return <DaemonSetsView />;
    case "statefulsets":
      return <StatefulSetsView />;
    case "jobs":
      return <JobsView />;
    case "cronjobs":
      return <CronJobsView />;

    // Networking
    case "ingresses":
      return <IngressesView />;
    case "endpoint-slices":
      return <EndpointSlicesView />;
    case "network-policies":
      return <NetworkPoliciesView />;
    case "ingress-classes":
      return <IngressClassesView />;

    // Configuration
    case "hpa":
      return <HPAsView />;
    case "limit-ranges":
      return <LimitRangesView />;
    case "resource-quotas":
      return <ResourceQuotasView />;
    case "pod-disruption-budgets":
      return <PDBsView />;

    // Storage
    case "persistent-volumes":
      return <PersistentVolumesView />;
    case "persistent-volume-claims":
      return <PersistentVolumeClaimsView />;
    case "storage-classes":
      return <StorageClassesView />;
    case "csi-drivers":
      return <CSIDriversView />;
    case "csi-nodes":
      return <CSINodesView />;
    case "volume-attachments":
      return <VolumeAttachmentsView />;

    // Access Control
    case "service-accounts":
      return <ServiceAccountsView />;
    case "roles":
      return <RolesView />;
    case "role-bindings":
      return <RoleBindingsView />;
    case "cluster-roles":
      return <ClusterRolesView />;
    case "cluster-role-bindings":
      return <ClusterRoleBindingsView />;

    // Administration
    case "crds":
      return <CRDsView />;
    case "priority-classes":
      return <PriorityClassesView />;
    case "runtime-classes":
      return <RuntimeClassesView />;
    case "mutating-webhooks":
      return <MutatingWebhooksView />;
    case "validating-webhooks":
      return <ValidatingWebhooksView />;

    // GitOps
    case "helm-releases":
      return <HelmReleasesView />;
    case "flux-kustomizations":
      return <FluxKustomizationsView />;

    // Special views
    case "pod-logs":
      return <PodLogsView />;

    default:
      return <ComingSoon resource={activeResource} />;
  }
}
