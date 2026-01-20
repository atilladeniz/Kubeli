"use client";

import { useState, createContext, useContext, useCallback, useMemo, useEffect } from "react";
import { Sidebar, type ResourceType } from "../layout/Sidebar";
import {
  ResourceList,
  podColumns,
  deploymentColumns,
  serviceColumns,
  configMapColumns,
  secretColumns,
  nodeColumns,
  namespaceColumns,
  eventColumns,
  leaseColumns,
  replicaSetColumns,
  daemonSetColumns,
  statefulSetColumns,
  jobColumns,
  cronJobColumns,
  ingressColumns,
  endpointSliceColumns,
  networkPolicyColumns,
  ingressClassColumns,
  hpaColumns,
  limitRangeColumns,
  resourceQuotaColumns,
  pdbColumns,
  pvColumns,
  pvcColumns,
  storageClassColumns,
  csiDriverColumns,
  csiNodeColumns,
  volumeAttachmentColumns,
  serviceAccountColumns,
  roleColumns,
  roleBindingColumns,
  clusterRoleColumns,
  clusterRoleBindingColumns,
  crdColumns,
  priorityClassColumns,
  runtimeClassColumns,
  mutatingWebhookColumns,
  validatingWebhookColumns,
  helmReleaseColumns,
  fluxKustomizationColumns,
  translateColumns,
  type SortDirection,
  type FilterOption,
  type BulkAction,
} from "./resources/ResourceList";
import { ResourceDetail, type ResourceData } from "./resources/ResourceDetail";
import { LogViewer } from "./logs/LogViewer";
import { ResourceDiagram } from "./visualization";
import { AIAssistant } from "./ai/AIAssistant";
import {
  usePods,
  useDeployments,
  useServices,
  useConfigMaps,
  useSecrets,
  useNodes,
  useNamespaces,
  useEvents,
  useLeases,
  useReplicaSets,
  useDaemonSets,
  useStatefulSets,
  useJobs,
  useCronJobs,
  useIngresses,
  useEndpointSlices,
  useNetworkPolicies,
  useIngressClasses,
  useHPAs,
  useLimitRanges,
  useResourceQuotas,
  usePDBs,
  usePersistentVolumes,
  usePersistentVolumeClaims,
  useStorageClasses,
  useCSIDrivers,
  useCSINodes,
  useVolumeAttachments,
  useServiceAccounts,
  useRoles,
  useRoleBindings,
  useClusterRoles,
  useClusterRoleBindings,
  useCRDs,
  usePriorityClasses,
  useRuntimeClasses,
  useMutatingWebhooks,
  useValidatingWebhooks,
  useHelmReleases,
  useFluxKustomizations,
} from "@/lib/hooks/useK8sResources";
import { useClusterMetrics } from "@/lib/hooks/useMetrics";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAIStore } from "@/lib/stores/ai-store";
import {
  AlertCircle,
  Box,
  FileText,
  X,
  Terminal as TerminalIcon,
  ArrowRightLeft,
  RefreshCw,
  Copy,
  Trash2,
  Eye,
  Scale,
  ExternalLink,
  Cpu,
  HardDrive,
  Info,
  Star,
  Minus,
  Plus,
  Pause,
  Play,
} from "lucide-react";
import type { PodInfo, ServiceInfo, NodeInfo, DeploymentInfo, ConfigMapInfo, SecretInfo, EventInfo, LeaseInfo, ReplicaSetInfo, DaemonSetInfo, StatefulSetInfo, JobInfo, CronJobInfo, IngressInfo, EndpointSliceInfo, NetworkPolicyInfo, IngressClassInfo, HPAInfo, LimitRangeInfo, ResourceQuotaInfo, PDBInfo, PVInfo, PVCInfo, StorageClassInfo, CSIDriverInfo, CSINodeInfo, VolumeAttachmentInfo, ServiceAccountInfo, RoleInfo, RoleBindingInfo, ClusterRoleInfo, ClusterRoleBindingInfo, CRDInfo, PriorityClassInfo, RuntimeClassInfo, MutatingWebhookInfo, ValidatingWebhookInfo, HelmReleaseInfo, FluxKustomizationInfo } from "@/lib/types";
import type { ContextMenuItemDef } from "./resources/ResourceList";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { TerminalTabsProvider, useTerminalTabs, TerminalTabs } from "./terminal";
import { SettingsPanel } from "./settings/SettingsPanel";
import { BrowserOpenDialog } from "./portforward/BrowserOpenDialog";
import { RestartDialog } from "./updates/RestartDialog";
import { Titlebar } from "../layout/Titlebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getResourceYaml, applyResourceYaml, deleteResource, scaleDeployment, reconcileFluxKustomization, suspendFluxKustomization, resumeFluxKustomization, reconcileFluxHelmRelease, suspendFluxHelmRelease, resumeFluxHelmRelease, uninstallHelmRelease } from "@/lib/tauri/commands";
import { useKeyboardShortcuts, NAVIGATION_SHORTCUTS } from "@/lib/hooks/useKeyboardShortcuts";
import { ShortcutsHelpDialog } from "./shortcuts/ShortcutsHelpDialog";

// Context for resource detail panel
interface ResourceDetailContextType {
  selectedResource: { data: ResourceData; type: string } | null;
  setSelectedResource: (resource: { data: ResourceData; type: string } | null) => void;
  openResourceDetail: (resourceType: string, name: string, namespace?: string, labels?: Record<string, string>) => void;
  handleDeleteFromContext: (resourceType: string, name: string, namespace?: string, onSuccess?: () => void) => void;
  handleUninstallFromContext: (name: string, namespace: string, onSuccess?: () => void) => void;
  handleScaleFromContext: (name: string, namespace: string, currentReplicas: number, onSuccess?: () => void) => void;
  closeResourceDetail: () => void;
}

const ResourceDetailContext = createContext<ResourceDetailContextType | null>(null);

function useResourceDetail() {
  const context = useContext(ResourceDetailContext);
  if (!context) throw new Error("useResourceDetail must be used within ResourceDetailProvider");
  return context;
}

export function Dashboard() {
  return (
    <TerminalTabsProvider>
      <DashboardContent />
      <SettingsPanel />
      <BrowserOpenDialog />
      <RestartDialog />
    </TerminalTabsProvider>
  );
}

function DashboardContent() {
  const t = useTranslations();
  const [activeResource, setActiveResource] = useState<ResourceType>("cluster-overview");
  const { isConnected, currentCluster } = useClusterStore();
  const { tabs, isOpen, setIsOpen } = useTerminalTabs();
  const [selectedResource, setSelectedResource] = useState<{ data: ResourceData; type: string } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; resourceType: string; name: string; namespace?: string; onConfirm: () => void } | null>(null);
  const [uninstallDialog, setUninstallDialog] = useState<{ open: boolean; name: string; namespace: string; onSuccess?: () => void } | null>(null);
  const [scaleDialog, setScaleDialog] = useState<{ open: boolean; name: string; namespace: string; currentReplicas: number; onSuccess?: () => void } | null>(null);
  const [newReplicas, setNewReplicas] = useState<number>(1);
  const [scaleToZeroWarning, setScaleToZeroWarning] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { getFavorites } = useFavoritesStore();
  const { setSettingsOpen, isAIAssistantOpen, toggleAIAssistant, pendingPodLogs } = useUIStore();
  const { isThinking, isStreaming } = useAIStore();
  const isAIProcessing = isThinking || isStreaming;

  const clusterContext = currentCluster?.context || "";
  const favorites = getFavorites(clusterContext);

  // Watch for pending pod logs navigation from AI assistant
  useEffect(() => {
    if (pendingPodLogs) {
      // Navigate to pods view - PodsView will pick up the pendingPodLogs
      setActiveResource("pods");
    }
  }, [pendingPodLogs]);

  // Navigate to favorite by index
  const navigateToFavorite = useCallback((index: number) => {
    if (index < favorites.length) {
      const fav = favorites[index];
      setActiveResource(fav.resourceType as ResourceType);
    }
  }, [favorites]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    { key: NAVIGATION_SHORTCUTS.GOTO_OVERVIEW, handler: () => setActiveResource("cluster-overview"), description: "Go to Overview" },
    { key: NAVIGATION_SHORTCUTS.GOTO_DIAGRAM, handler: () => setActiveResource("resource-diagram"), description: "Go to Diagram" },
    { key: NAVIGATION_SHORTCUTS.GOTO_PODS, handler: () => setActiveResource("pods"), description: "Go to Pods" },
    { key: NAVIGATION_SHORTCUTS.GOTO_DEPLOYMENTS, handler: () => setActiveResource("deployments"), description: "Go to Deployments" },
    { key: NAVIGATION_SHORTCUTS.GOTO_SERVICES, handler: () => setActiveResource("services"), description: "Go to Services" },
    { key: NAVIGATION_SHORTCUTS.GOTO_NODES, handler: () => setActiveResource("nodes"), description: "Go to Nodes" },
    { key: NAVIGATION_SHORTCUTS.GOTO_CONFIGMAPS, handler: () => setActiveResource("configmaps"), description: "Go to ConfigMaps" },
    { key: NAVIGATION_SHORTCUTS.GOTO_SECRETS, handler: () => setActiveResource("secrets"), description: "Go to Secrets" },
    { key: NAVIGATION_SHORTCUTS.GOTO_NAMESPACES, handler: () => setActiveResource("namespaces"), description: "Go to Namespaces" },
    { key: NAVIGATION_SHORTCUTS.HELP, handler: () => setShowShortcutsHelp(true), description: "Show shortcuts help" },
    { key: NAVIGATION_SHORTCUTS.TOGGLE_AI, handler: toggleAIAssistant, description: "Toggle AI Assistant" },
    // Favorite shortcuts (Cmd+1 through Cmd+9)
    { key: NAVIGATION_SHORTCUTS.FAVORITE_1, meta: true, handler: () => navigateToFavorite(0), description: "Go to Favorite 1" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_2, meta: true, handler: () => navigateToFavorite(1), description: "Go to Favorite 2" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_3, meta: true, handler: () => navigateToFavorite(2), description: "Go to Favorite 3" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_4, meta: true, handler: () => navigateToFavorite(3), description: "Go to Favorite 4" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_5, meta: true, handler: () => navigateToFavorite(4), description: "Go to Favorite 5" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_6, meta: true, handler: () => navigateToFavorite(5), description: "Go to Favorite 6" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_7, meta: true, handler: () => navigateToFavorite(6), description: "Go to Favorite 7" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_8, meta: true, handler: () => navigateToFavorite(7), description: "Go to Favorite 8" },
    { key: NAVIGATION_SHORTCUTS.FAVORITE_9, meta: true, handler: () => navigateToFavorite(8), description: "Go to Favorite 9" },
  ], [navigateToFavorite, toggleAIAssistant]);

  useKeyboardShortcuts(shortcuts, { enabled: isConnected });

  const openResourceDetail = async (resourceType: string, name: string, namespace?: string) => {
    setIsLoadingDetail(true);
    try {
      const yamlData = await getResourceYaml(resourceType, name, namespace);
      setSelectedResource({
        type: resourceType,
        data: {
          name: yamlData.name,
          namespace: yamlData.namespace || undefined,
          uid: yamlData.uid,
          apiVersion: yamlData.api_version,
          kind: yamlData.kind,
          createdAt: yamlData.created_at || undefined,
          labels: yamlData.labels,
          annotations: yamlData.annotations,
          yaml: yamlData.yaml,
        },
      });
    } catch (err) {
      console.error("Failed to load resource details:", err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSaveResource = async (yaml: string) => {
    await applyResourceYaml(yaml);
    // Refresh the detail after save
    if (selectedResource) {
      await openResourceDetail(
        selectedResource.type,
        selectedResource.data.name,
        selectedResource.data.namespace
      );
    }
  };

  const handleDeleteResource = async () => {
    if (!selectedResource) return;
    await deleteResource(
      selectedResource.type,
      selectedResource.data.name,
      selectedResource.data.namespace
    );
    setSelectedResource(null);
  };

  const handleDeleteFromContext = (resourceType: string, name: string, namespace?: string, onSuccess?: () => void) => {
    setDeleteDialog({
      open: true,
      resourceType,
      name,
      namespace,
      onConfirm: async () => {
        await deleteResource(resourceType, name, namespace);
        setDeleteDialog(null);
        onSuccess?.();
      },
    });
  };

  const handleUninstallFromContext = (name: string, namespace: string, onSuccess?: () => void) => {
    setUninstallDialog({
      open: true,
      name,
      namespace,
      onSuccess,
    });
  };

  const handleScaleFromContext = (name: string, namespace: string, currentReplicas: number, onSuccess?: () => void) => {
    setNewReplicas(currentReplicas);
    setScaleDialog({ open: true, name, namespace, currentReplicas, onSuccess });
  };

  const handleScaleConfirm = async () => {
    if (!scaleDialog) return;
    // Show warning if scaling to 0
    if (newReplicas === 0) {
      setScaleToZeroWarning(true);
      return;
    }
    await executeScale();
  };

  const executeScale = async () => {
    if (!scaleDialog) return;
    try {
      await scaleDeployment(scaleDialog.name, scaleDialog.namespace, newReplicas);
      toast.success(t("workloads.scale"), { description: `${scaleDialog.name} → ${newReplicas} ${t("workloads.replicas").toLowerCase()}` });
      scaleDialog.onSuccess?.();
      setScaleDialog(null);
      setScaleToZeroWarning(false);
    } catch (err) {
      toast.error(t("errors.loadFailed"), { description: String(err) });
    }
  };

  const closeResourceDetail = () => {
    setSelectedResource(null);
  };

  return (
    <ResourceDetailContext.Provider value={{ selectedResource, setSelectedResource, openResourceDetail, handleDeleteFromContext, handleUninstallFromContext, handleScaleFromContext, closeResourceDetail }}>
      <div className="flex h-screen bg-background text-foreground overscroll-none">
        <Sidebar activeResource={activeResource} onResourceSelect={setActiveResource} />
        <div className="flex flex-1 overflow-hidden overscroll-none">
          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Titlebar drag region for content area */}
            <Titlebar
              isAIOpen={isAIAssistantOpen}
              isAIProcessing={isAIProcessing}
              onToggleAI={toggleAIAssistant}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            <main className={cn("flex-1 overflow-hidden", isOpen && "h-[60%]")}>
              {!isConnected ? (
                <NotConnectedState />
              ) : (
                <ResourceView activeResource={activeResource} />
              )}
            </main>

            {/* Terminal panel */}
            {isOpen && tabs.length > 0 && (
              <div className="h-[40%] border-t border-border">
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between bg-muted/50 px-3 py-1 border-b border-border">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t("terminal.title")}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0">
                    <TerminalTabs initialTabs={tabs} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resource Detail Panel */}
          {selectedResource && (
            <div className="w-[700px] border-l border-border flex-shrink-0">
              <ResourceDetail
                resource={selectedResource.data}
                resourceType={selectedResource.type}
                onClose={() => setSelectedResource(null)}
                onSave={handleSaveResource}
                onDelete={handleDeleteResource}
                isLoading={isLoadingDetail}
              />
            </div>
          )}

          {/* AI Assistant Panel - Resizable */}
          {isAIAssistantOpen && (
            <div
              className="min-w-[300px] max-w-[600px] border-l border-border flex-shrink-0 overflow-auto"
              style={{
                width: 400,
                resize: "horizontal",
                direction: "rtl" // Makes resize handle appear on left side
              }}
            >
              <div style={{ direction: "ltr" }} className="h-full">
                <AIAssistant />
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialog?.open} onOpenChange={(open) => !open && setDeleteDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common.delete")} {deleteDialog?.resourceType}?</AlertDialogTitle>
              <AlertDialogDescription>
                {t("messages.confirmDelete", { name: deleteDialog?.name || "" })}
                {deleteDialog?.namespace && <> ({t("cluster.namespace")}: <strong>{deleteDialog.namespace}</strong>)</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteDialog?.onConfirm()}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Uninstall Helm Release Dialog */}
        <AlertDialog open={uninstallDialog?.open} onOpenChange={(open) => !open && setUninstallDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Uninstall Helm Release?</AlertDialogTitle>
              <AlertDialogDescription>
                {t("messages.confirmDelete", { name: uninstallDialog?.name || "" })}
                {uninstallDialog?.namespace && <> ({t("cluster.namespace")}: <strong>{uninstallDialog.namespace}</strong>)</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (uninstallDialog) {
                    try {
                      await uninstallHelmRelease(uninstallDialog.name, uninstallDialog.namespace);
                      toast.success("Release uninstalled", { description: uninstallDialog.name });
                      uninstallDialog.onSuccess?.();
                    } catch (e) {
                      toast.error("Failed to uninstall", { description: String(e) });
                    }
                    setUninstallDialog(null);
                  }
                }}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Uninstall
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Scale Deployment Dialog */}
        <Dialog open={scaleDialog?.open} onOpenChange={(open) => !open && setScaleDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("workloads.scale")} {t("navigation.deployments")}</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("workloads.scale")} <strong>{scaleDialog?.name}</strong> ({t("cluster.namespace")}: <strong>{scaleDialog?.namespace}</strong>)
              </p>
              <div className="space-y-2">
                <Label htmlFor="replicas">{t("workloads.replicas")}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewReplicas(Math.max(0, newReplicas - 1))}
                    disabled={newReplicas <= 0}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <Input
                    id="replicas"
                    type="number"
                    min={0}
                    value={newReplicas}
                    onChange={(e) => setNewReplicas(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setNewReplicas(newReplicas + 1)}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {scaleDialog?.currentReplicas} {t("workloads.replicas").toLowerCase()}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScaleDialog(null)}>{t("common.cancel")}</Button>
              <Button onClick={handleScaleConfirm}>{t("workloads.scale")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Scale to Zero Warning Dialog */}
        <AlertDialog open={scaleToZeroWarning} onOpenChange={setScaleToZeroWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("workloads.scale")} → 0?</AlertDialogTitle>
              <AlertDialogDescription>
                {t("workloads.scale")} <strong>{scaleDialog?.name}</strong> → 0 {t("workloads.replicas").toLowerCase()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setScaleToZeroWarning(false)}>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeScale}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {t("workloads.scale")} → 0
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Keyboard Shortcuts Help */}
        <ShortcutsHelpDialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
      </div>
    </ResourceDetailContext.Provider>
  );
}

function NotConnectedState() {
  const t = useTranslations();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-2xl bg-muted p-6">
        <AlertCircle className="size-16 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{t("cluster.disconnected")}</h2>
      <p className="text-muted-foreground">{t("cluster.selectClusterDesc")}</p>
    </div>
  );
}

function ResourceView({ activeResource }: { activeResource: ResourceType }) {
  switch (activeResource) {
    case "cluster-overview":
      return <ClusterOverview />;
    case "resource-diagram":
      return <ResourceDiagram />;
    case "workloads-overview":
      return <WorkloadsOverview />;
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
    case "ingresses":
      return <IngressesView />;
    case "endpoint-slices":
      return <EndpointSlicesView />;
    case "network-policies":
      return <NetworkPoliciesView />;
    case "ingress-classes":
      return <IngressClassesView />;
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
    case "helm-releases":
      return <HelmReleasesView />;
    case "flux-kustomizations":
      return <FluxKustomizationsView />;
    default:
      return <ComingSoon resource={activeResource} />;
  }
}

function ClusterOverview() {
  const t = useTranslations();
  const { currentCluster } = useClusterStore();
  const { data: pods } = usePods();
  const { data: deployments } = useDeployments();
  const { data: services } = useServices();
  const { data: nodes } = useNodes();
  const { summary: metrics, metricsAvailable, isLoading: metricsLoading } = useClusterMetrics({
    autoRefresh: true,
    refreshInterval: 15000,
  });

  const runningPods = pods.filter((p) => p.phase === "Running").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;
  const failedPods = pods.filter((p) => p.phase === "Failed").length;

  const readyNodes = nodes.filter((n) => n.status === "Ready").length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("navigation.overview")}</h1>
        <p className="text-muted-foreground">{currentCluster?.name || t("cluster.noCluster")}</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <SummaryCard
          title={t("navigation.nodes")}
          value={nodes.length}
          subtitle={`${readyNodes} ${t("workloads.ready").toLowerCase()}`}
          status={readyNodes === nodes.length ? "healthy" : "warning"}
        />
        <SummaryCard
          title={t("navigation.pods")}
          value={pods.length}
          subtitle={`${runningPods} ${t("pods.running").toLowerCase()}`}
          status={failedPods > 0 ? "error" : pendingPods > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("navigation.deployments")}
          value={deployments.length}
          status="healthy"
        />
        <SummaryCard
          title={t("navigation.services")}
          value={services.length}
          status="healthy"
        />
      </div>

      {/* Metrics Section */}
      {metricsAvailable && metrics && (
        <div className="mb-8 grid grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4" />
                {t("metrics.cpuUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsProgressBar
                percentage={metrics.cpu.percentage}
                used={metrics.cpu.usage}
                total={metrics.cpu.allocatable}
                color="blue"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4" />
                {t("metrics.memoryUsage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MetricsProgressBar
                percentage={metrics.memory.percentage}
                used={metrics.memory.usage}
                total={metrics.memory.allocatable}
                color="purple"
              />
            </CardContent>
          </Card>
        </div>
      )}

      {!metricsAvailable && !metricsLoading && (
        <Card className="mb-8 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Info className="size-5 text-yellow-500" />
            <div>
              <p className="text-sm font-medium">{t("metrics.metricsNotAvailable")}</p>
              <p className="text-xs text-muted-foreground">
                {t("metrics.metricsNotAvailableHint")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource Status */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navigation.pods")} {t("common.status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("pods.running")} value={runningPods} color="green" />
            <StatusRow label={t("pods.pending")} value={pendingPods} color="yellow" />
            <StatusRow label={t("pods.failed")} value={failedPods} color="red" />
            <StatusRow
              label={t("pods.succeeded")}
              value={pods.filter((p) => p.phase === "Succeeded").length}
              color="blue"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("navigation.nodes")} {t("common.status")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("workloads.ready")} value={readyNodes} color="green" />
            <StatusRow label={t("metrics.notReady")} value={nodes.length - readyNodes} color="red" />
          </CardContent>
        </Card>
      </div>

      {/* Top Resource Consumers */}
      {metricsAvailable && metrics && (metrics.top_cpu_pods.length > 0 || metrics.top_memory_pods.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="size-4" />
                {t("metrics.topCpuConsumers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.top_cpu_pods.slice(0, 5).map((pod) => (
                <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between text-sm">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{pod.name}</span>
                    <span className="text-xs text-muted-foreground">{pod.namespace}</span>
                  </div>
                  <span className="ml-2 font-mono text-muted-foreground">{pod.total_cpu}</span>
                </div>
              ))}
              {metrics.top_cpu_pods.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("metrics.noPodMetrics")}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="size-4" />
                {t("metrics.topMemoryConsumers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {metrics.top_memory_pods.slice(0, 5).map((pod) => (
                <div key={`${pod.namespace}/${pod.name}`} className="flex items-center justify-between text-sm">
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="truncate font-medium">{pod.name}</span>
                    <span className="text-xs text-muted-foreground">{pod.namespace}</span>
                  </div>
                  <span className="ml-2 font-mono text-muted-foreground">{pod.total_memory}</span>
                </div>
              ))}
              {metrics.top_memory_pods.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("metrics.noPodMetrics")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function WorkloadsOverview() {
  const t = useTranslations("workloads");
  const { currentNamespace } = useClusterStore();
  const { data: pods } = usePods();
  const { data: deployments } = useDeployments();
  const { data: replicaSets } = useReplicaSets();
  const { data: daemonSets } = useDaemonSets();
  const { data: statefulSets } = useStatefulSets();
  const { data: jobs } = useJobs();
  const { data: cronJobs } = useCronJobs();

  // Pod statistics
  const runningPods = pods.filter((p) => p.phase === "Running").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;
  const failedPods = pods.filter((p) => p.phase === "Failed").length;
  const succeededPods = pods.filter((p) => p.phase === "Succeeded").length;

  // Deployment statistics
  const healthyDeployments = deployments.filter((d) => d.ready_replicas === d.replicas && d.replicas > 0).length;
  const degradedDeployments = deployments.filter((d) => d.ready_replicas < d.replicas && d.ready_replicas > 0).length;
  const failedDeployments = deployments.filter((d) => d.ready_replicas === 0 && d.replicas > 0).length;

  // DaemonSet statistics
  const healthyDaemonSets = daemonSets.filter((ds) => ds.number_ready === ds.desired_number_scheduled).length;

  // StatefulSet statistics
  const healthyStatefulSets = statefulSets.filter((sts) => sts.ready_replicas === sts.replicas && sts.replicas > 0).length;

  // Job statistics
  const completedJobs = jobs.filter((j) => j.status === "Complete").length;
  const runningJobs = jobs.filter((j) => j.status === "Running").length;
  const failedJobs = jobs.filter((j) => j.status === "Failed").length;

  // CronJob statistics
  const activeCronJobs = cronJobs.filter((cj) => !cj.suspend).length;
  const suspendedCronJobs = cronJobs.filter((cj) => cj.suspend).length;

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("overview")}</h1>
        <p className="text-muted-foreground">
          {currentNamespace ? t("namespaceLabel", { namespace: currentNamespace }) : t("allNamespaces")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-4 gap-4">
        <SummaryCard
          title={t("pods")}
          value={pods.length}
          subtitle={t("countRunning", { count: runningPods })}
          status={failedPods > 0 ? "error" : pendingPods > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("deployments")}
          value={deployments.length}
          subtitle={t("countHealthy", { count: healthyDeployments })}
          status={failedDeployments > 0 ? "error" : degradedDeployments > 0 ? "warning" : "healthy"}
        />
        <SummaryCard
          title={t("statefulsets")}
          value={statefulSets.length}
          subtitle={t("countHealthy", { count: healthyStatefulSets })}
          status={healthyStatefulSets === statefulSets.length ? "healthy" : "warning"}
        />
        <SummaryCard
          title={t("daemonsets")}
          value={daemonSets.length}
          subtitle={t("countHealthy", { count: healthyDaemonSets })}
          status={healthyDaemonSets === daemonSets.length ? "healthy" : "warning"}
        />
      </div>

      {/* Detailed Status */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Pod Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("podStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("running")} value={runningPods} color="green" />
            <StatusRow label={t("pending")} value={pendingPods} color="yellow" />
            <StatusRow label={t("failed")} value={failedPods} color="red" />
            <StatusRow label={t("succeeded")} value={succeededPods} color="blue" />
          </CardContent>
        </Card>

        {/* Deployment Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("deploymentStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("healthy")} value={healthyDeployments} color="green" />
            <StatusRow label={t("degraded")} value={degradedDeployments} color="yellow" />
            <StatusRow label={t("failed")} value={failedDeployments} color="red" />
          </CardContent>
        </Card>

        {/* Job Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("jobStatus")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("complete")} value={completedJobs} color="green" />
            <StatusRow label={t("running")} value={runningJobs} color="blue" />
            <StatusRow label={t("failed")} value={failedJobs} color="red" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Resources */}
      <div className="grid grid-cols-3 gap-6">
        {/* ReplicaSets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("replicasets")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{replicaSets.length}</div>
            <p className="text-sm text-muted-foreground">
              {t("fullyReady", { count: replicaSets.filter((rs) => rs.ready_replicas === rs.replicas).length })}
            </p>
          </CardContent>
        </Card>

        {/* CronJobs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("cronjobs")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <StatusRow label={t("active")} value={activeCronJobs} color="green" />
            <StatusRow label={t("suspended")} value={suspendedCronJobs} color="yellow" />
          </CardContent>
        </Card>

        {/* Total Workloads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("totalWorkloads")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {deployments.length + statefulSets.length + daemonSets.length + jobs.length + cronJobs.length}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("acrossAllTypes")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricsProgressBar({
  percentage,
  used,
  total,
  color,
}: {
  percentage: number;
  used: string;
  total: string;
  color: "blue" | "purple" | "green" | "red";
}) {
  const colors = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    green: "bg-green-500",
    red: "bg-destructive",
  };

  const bgColors = {
    blue: "bg-blue-500/20",
    purple: "bg-purple-500/20",
    green: "bg-green-500/20",
    red: "bg-destructive/20",
  };

  const clampedPercentage = Math.min(100, Math.max(0, percentage));
  const isWarning = percentage > 80;
  const isCritical = percentage > 90;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{used} / {total}</span>
        <span className={cn(
          "font-medium",
          isCritical ? "text-destructive" : isWarning ? "text-yellow-500" : "text-foreground"
        )}>
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className={cn("h-2 rounded-full overflow-hidden", bgColors[color])}>
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            isCritical ? "bg-destructive" : isWarning ? "bg-yellow-500" : colors[color]
          )}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string;
  value: number;
  subtitle?: string;
  status: "healthy" | "warning" | "error";
}) {
  const statusColors = {
    healthy: "border-green-500/30 bg-green-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    error: "border-destructive/30 bg-destructive/5",
  };

  return (
    <Card className={cn("py-4", statusColors[status])}>
      <CardContent className="p-0 px-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="text-3xl font-bold">{value}</p>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "green" | "yellow" | "red" | "blue";
}) {
  const colors = {
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    red: "bg-destructive",
    blue: "bg-blue-500",
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", colors[color])} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PodsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh, startWatch, stopWatchFn, isWatching } = usePods({
    autoWatch: true,        // Auto-start WebSocket watch (efficient real-time updates)
    autoRefresh: true,      // Fallback polling when watch is not active
    refreshInterval: 10000, // 10s fallback interval (only used when watch is off)
  });
  const { data: services } = useServices({ autoRefresh: true, refreshInterval: 30000 });
  const { forwards, startForward, stopForward } = usePortForward();
  const [selectedPod, setSelectedPod] = useState<PodInfo | null>(null);
  const { addTab } = useTerminalTabs();
  const { openResourceDetail, handleDeleteFromContext, closeResourceDetail } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const { pendingPodLogs, setPendingPodLogs } = useUIStore();
  const clusterContext = currentCluster?.context || "";

  // Watch for pending pod logs from AI assistant link clicks
  // This is a valid use case: responding to external state changes (link clicks from AI chat)
  useEffect(() => {
    if (pendingPodLogs && data) {
      // Find the matching pod
      const matchingPod = data.find(
        (pod) => pod.namespace === pendingPodLogs.namespace && pod.name === pendingPodLogs.podName
      );
      if (matchingPod) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- External navigation trigger, not a derived state
        setSelectedPod(matchingPod);
      }
      // Clear the pending navigation
      setPendingPodLogs(null);
    }
  }, [pendingPodLogs, data, setPendingPodLogs]);

  // Pod status filters
  const podFilters: FilterOption<PodInfo>[] = useMemo(() => [
    { key: "running", label: "Running", predicate: (p) => p.phase === "Running", color: "green" },
    { key: "pending", label: "Pending", predicate: (p) => p.phase === "Pending", color: "yellow" },
    { key: "failed", label: "Failed", predicate: (p) => p.phase === "Failed", color: "red" },
    { key: "succeeded", label: "Succeeded", predicate: (p) => p.phase === "Succeeded", color: "blue" },
  ], []);

  // Bulk actions for pods
  const podBulkActions: BulkAction<PodInfo>[] = useMemo(() => [
    {
      key: "delete",
      label: "Delete",
      icon: <Trash2 className="size-3.5" />,
      variant: "destructive",
      onAction: async (pods) => {
        for (const pod of pods) {
          try {
            await deleteResource("pod", pod.name, pod.namespace);
          } catch (err) {
            console.error(`Failed to delete pod ${pod.name}:`, err);
          }
        }
        toast.success(`Deleted ${pods.length} pod(s)`);
        if (!isWatching) {
          refresh();
        }
      },
    },
  ], [refresh, isWatching]);

  const handleOpenShell = (pod: PodInfo) => {
    addTab(pod.namespace, pod.name);
  };

  // Find matching service for a pod based on label selectors
  const findServiceForPod = (pod: PodInfo): ServiceInfo | undefined => {
    return services.find((svc) => {
      // Must be in same namespace
      if (svc.namespace !== pod.namespace) return false;
      // Service must have a selector
      if (!svc.selector || Object.keys(svc.selector).length === 0) return false;
      // All selector labels must match pod labels
      return Object.entries(svc.selector).every(
        ([key, value]) => pod.labels[key] === value
      );
    });
  };

  // Check if pod's service is being forwarded
  const getForwardForPod = (pod: PodInfo) => {
    const service = findServiceForPod(pod);
    if (!service) return undefined;
    return forwards.find(
      (f) =>
        f.name === service.name &&
        f.namespace === service.namespace &&
        f.target_type === "service"
    );
  };

  const handlePortForward = (pod: PodInfo) => {
    const service = findServiceForPod(pod);
    if (service && service.ports.length > 0) {
      const port = service.ports[0];
      startForward(service.namespace, service.name, "service", port.port);
    }
  };

  const handleDisconnect = (pod: PodInfo) => {
    const forward = getForwardForPod(pod);
    if (forward) {
      stopForward(forward.forward_id);
    }
  };

  // Get row class for highlighting forwarded pods
  const getRowClassName = (pod: PodInfo): string => {
    if (pod.deletion_timestamp) {
      return "bg-muted/40 text-muted-foreground";
    }
    const forward = getForwardForPod(pod);
    if (forward) {
      return "bg-purple-500/10 hover:bg-purple-500/15";
    }
    return "";
  };

  // Add logs and shell action columns
  const columnsWithActions = [
    ...translateColumns(podColumns, t),
    {
      key: "actions",
      label: t("columns.actions") || "ACTIONS",
      render: (pod: PodInfo) => {
        const isTerminating = !!pod.deletion_timestamp;
        const service = findServiceForPod(pod);
        const forward = getForwardForPod(pod);
        const isForwarded = !!forward;
        const canForward = !!service && service.ports.length > 0;

        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={isTerminating}
              onClick={(e) => {
                e.stopPropagation();
                closeResourceDetail();
                setSelectedPod(pod);
              }}
              className="h-7 px-2 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
            >
              <FileText className="size-3.5" />
              Logs
            </Button>
            {pod.phase === "Running" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isTerminating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenShell(pod);
                }}
                className="h-7 px-2 text-green-500 hover:text-green-600 hover:bg-green-500/10"
              >
                <TerminalIcon className="size-3.5" />
                Shell
              </Button>
            )}
            {canForward && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isTerminating}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isForwarded) {
                    handleDisconnect(pod);
                  } else {
                    handlePortForward(pod);
                  }
                }}
                className={cn(
                  "h-7 px-2",
                  isForwarded
                    ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    : "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                )}
              >
                <ArrowRightLeft className="size-3.5" />
                {isForwarded ? "Stop Port" : "Forward"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const getPodContextMenu = (pod: PodInfo): ContextMenuItemDef[] => {
    const isTerminating = !!pod.deletion_timestamp;
    const service = findServiceForPod(pod);
    const forward = getForwardForPod(pod);
    const isForwarded = !!forward;
    const canForward = !!service && service.ports.length > 0;
    const isFav = isFavorite(clusterContext, "pods", pod.name, pod.namespace);

    return [
      {
        label: "View Details",
        icon: <Eye className="size-4" />,
        onClick: () => {
          setSelectedPod(null);
          openResourceDetail("pod", pod.name, pod.namespace);
        },
      },
      {
        label: "View Logs",
        icon: <FileText className="size-4" />,
        onClick: () => {
          closeResourceDetail();
          setSelectedPod(pod);
        },
        disabled: isTerminating,
      },
      {
        label: "Open Shell",
        icon: <TerminalIcon className="size-4" />,
        onClick: () => handleOpenShell(pod),
        disabled: isTerminating || pod.phase !== "Running",
      },
      ...(canForward
        ? [
            { separator: true, label: "", onClick: () => {} },
            {
              label: isForwarded ? "Stop Port Forward" : "Port Forward",
              icon: <ArrowRightLeft className="size-4" />,
              onClick: () =>
                isForwarded ? handleDisconnect(pod) : handlePortForward(pod),
              disabled: isTerminating,
            },
          ]
        : []),
      { separator: true, label: "", onClick: () => {} },
      {
        label: isFav ? "Remove from Favorites" : "Add to Favorites",
        icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
        onClick: () => {
          if (isFav) {
            const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
            const fav = favs.find(f => f.resourceType === "pods" && f.name === pod.name && f.namespace === pod.namespace);
            if (fav) removeFavorite(clusterContext, fav.id);
          } else {
            addFavorite(clusterContext, "pods", pod.name, pod.namespace);
            toast.success("Added to favorites", { description: pod.name });
          }
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(pod.name);
          toast.success("Copied to clipboard", { description: pod.name });
        },
      },
      {
        label: "Copy Full Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          const fullName = `${pod.namespace}/${pod.name}`;
          navigator.clipboard.writeText(fullName);
          toast.success("Copied to clipboard", { description: fullName });
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Delete Pod",
        icon: <Trash2 className="size-4" />,
        onClick: () =>
          handleDeleteFromContext("pod", pod.name, pod.namespace, () => {
            if (!isWatching) {
              refresh();
            }
          }),
        variant: "destructive",
        disabled: isTerminating,
      },
    ];
  };

  if (selectedPod) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPod(null)}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
            Back to Pods
          </Button>
        </div>
        <div className="flex-1 overflow-hidden min-h-0">
          <LogViewer
            namespace={selectedPod.namespace}
            podName={selectedPod.name}
            onClose={() => setSelectedPod(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <ResourceList
      title={t("navigation.pods")}
      data={data}
      columns={columnsWithActions}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      isWatching={isWatching}
      onStartWatch={startWatch}
      onStopWatch={stopWatchFn}
      onRowClick={(pod) => {
        setSelectedPod(null);
        openResourceDetail("pod", pod.name, pod.namespace);
      }}
      getRowKey={(pod) => pod.uid}
      getRowClassName={getRowClassName}
      getRowNamespace={(pod) => pod.namespace}
      emptyMessage={t("empty.pods")}
      contextMenuItems={getPodContextMenu}
      filterOptions={podFilters}
      bulkActions={podBulkActions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function DeploymentsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useDeployments({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext, handleScaleFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const clusterContext = currentCluster?.context || "";

  const getDeploymentContextMenu = (dep: DeploymentInfo): ContextMenuItemDef[] => {
    const isFav = isFavorite(clusterContext, "deployments", dep.name, dep.namespace);
    return [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("deployment", dep.name, dep.namespace),
    },
    {
      label: "Scale",
      icon: <Scale className="size-4" />,
      onClick: () => handleScaleFromContext(dep.name, dep.namespace, dep.replicas, refresh),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: isFav ? "Remove from Favorites" : "Add to Favorites",
      icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
      onClick: () => {
        if (isFav) {
          const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
          const fav = favs.find(f => f.resourceType === "deployments" && f.name === dep.name && f.namespace === dep.namespace);
          if (fav) removeFavorite(clusterContext, fav.id);
        } else {
          addFavorite(clusterContext, "deployments", dep.name, dep.namespace);
          toast.success("Added to favorites", { description: dep.name });
        }
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(dep.name);
        toast.success("Copied to clipboard", { description: dep.name });
      },
    },
    {
      label: "Restart",
      icon: <RefreshCw className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Restart ${dep.name}` }),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("deployment", dep.name, dep.namespace, refresh),
      variant: "destructive",
    },
  ];
  };

  return (
    <ResourceList
      title={t("navigation.deployments")}
      data={data}
      columns={translateColumns(deploymentColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(dep) => dep.uid}
      getRowNamespace={(dep) => dep.namespace}
      emptyMessage={t("empty.deployments")}
      contextMenuItems={getDeploymentContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function PortForwardsView() {
  const { forwards, stopForward } = usePortForward();
  const [stopDialog, setStopDialog] = useState<{ forwardId: string; name: string } | null>(null);

  const handleOpenInBrowser = async (port: number) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${port}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
      // Fallback to window.open
      window.open(`http://localhost:${port}`, "_blank");
    }
  };

  const handleStop = (forwardId: string, name: string) => {
    setStopDialog({ forwardId, name });
  };

  const confirmStop = () => {
    if (stopDialog) {
      stopForward(stopDialog.forwardId);
      setStopDialog(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-400";
      case "connecting":
        return "bg-yellow-400 animate-pulse";
      case "error":
        return "bg-red-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      case "disconnected":
        return "Disconnected";
      default:
        return status;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Port Forwards</h1>
          <Badge variant="secondary">{forwards.length}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {forwards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <ArrowRightLeft className="size-12 stroke-1" />
            <div className="text-center">
              <p className="font-medium">No active port forwards</p>
              <p className="text-sm">Start a port forward from Services or Pods view</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {forwards.map((forward) => (
              <div
                key={forward.forward_id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-4">
                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2.5 rounded-full", getStatusColor(forward.status))} />
                    <span className="text-sm font-medium w-24">{getStatusText(forward.status)}</span>
                  </div>

                  {/* Service Info */}
                  <div className="flex flex-col">
                    <span className="font-medium">{forward.name}</span>
                    <span className="text-sm text-muted-foreground">{forward.namespace}</span>
                  </div>

                  {/* Ports */}
                  <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-1.5">
                    <span className="text-sm font-mono">localhost:{forward.local_port}</span>
                    <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                    <span className="text-sm font-mono">{forward.target_port}</span>
                  </div>

                  {/* Type */}
                  <Badge variant="outline" className="capitalize">
                    {forward.target_type}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenInBrowser(forward.local_port)}
                    disabled={forward.status !== "connected"}
                  >
                    <ExternalLink className="size-4" />
                    Open
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleStop(forward.forward_id, forward.name)}
                  >
                    <X className="size-4" />
                    Stop
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stop Confirmation Dialog */}
      <AlertDialog open={!!stopDialog} onOpenChange={(open) => !open && setStopDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Port Forward?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the port forward for <strong>{stopDialog?.name}</strong>?
              This will disconnect any active connections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ServicesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useServices({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { forwards, startForward, stopForward } = usePortForward();
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { currentCluster } = useClusterStore();
  const { addFavorite, removeFavorite, isFavorite } = useFavoritesStore();
  const clusterContext = currentCluster?.context || "";

  // Check if a service is currently being forwarded
  const getForwardForService = (svc: ServiceInfo) => {
    return forwards.find(
      (f) =>
        f.name === svc.name &&
        f.namespace === svc.namespace &&
        f.target_type === "service"
    );
  };

  const handlePortForward = (svc: ServiceInfo) => {
    if (svc.ports.length > 0) {
      const port = svc.ports[0];
      startForward(svc.namespace, svc.name, "service", port.port);
    }
  };

  const handleDisconnect = (svc: ServiceInfo) => {
    const forward = getForwardForService(svc);
    if (forward) {
      stopForward(forward.forward_id);
    }
  };

  // Get row class for highlighting forwarded services
  const getRowClassName = (svc: ServiceInfo): string => {
    const forward = getForwardForService(svc);
    if (forward) {
      return "bg-purple-500/10 hover:bg-purple-500/15";
    }
    return "";
  };

  // Add port forward action column
  const columnsWithActions = [
    ...translateColumns(serviceColumns, t),
    {
      key: "actions",
      label: "Actions",
      render: (svc: ServiceInfo) => {
        const forward = getForwardForService(svc);
        const isForwarded = !!forward;

        return (
          <div className="flex items-center gap-1">
            {svc.ports.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isForwarded) {
                    handleDisconnect(svc);
                  } else {
                    handlePortForward(svc);
                  }
                }}
                className={cn(
                  "h-7 px-2",
                  isForwarded
                    ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    : "text-purple-500 hover:text-purple-600 hover:bg-purple-500/10"
                )}
              >
                <ArrowRightLeft className="size-3.5" />
                {isForwarded ? "Stop Port" : "Forward"}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const getServiceContextMenu = (svc: ServiceInfo): ContextMenuItemDef[] => {
    const forward = getForwardForService(svc);
    const isForwarded = !!forward;
    const isFav = isFavorite(clusterContext, "services", svc.name, svc.namespace);

    return [
      {
        label: "View Details",
        icon: <Eye className="size-4" />,
        onClick: () => openResourceDetail("service", svc.name, svc.namespace),
      },
      {
        label: isForwarded ? "Stop Port Forward" : "Port Forward",
        icon: <ArrowRightLeft className="size-4" />,
        onClick: () => (isForwarded ? handleDisconnect(svc) : handlePortForward(svc)),
        disabled: svc.ports.length === 0,
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: isFav ? "Remove from Favorites" : "Add to Favorites",
        icon: <Star className={cn("size-4", isFav && "fill-yellow-500 text-yellow-500")} />,
        onClick: () => {
          if (isFav) {
            const favs = useFavoritesStore.getState().favorites[clusterContext] || [];
            const fav = favs.find(f => f.resourceType === "services" && f.name === svc.name && f.namespace === svc.namespace);
            if (fav) removeFavorite(clusterContext, fav.id);
          } else {
            addFavorite(clusterContext, "services", svc.name, svc.namespace);
            toast.success("Added to favorites", { description: svc.name });
          }
        },
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(svc.name);
          toast.success("Copied to clipboard", { description: svc.name });
        },
      },
      {
        label: "Copy Cluster IP",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(svc.cluster_ip || "");
          toast.success("Copied to clipboard", { description: svc.cluster_ip });
        },
        disabled: !svc.cluster_ip,
      },
      { separator: true, label: "", onClick: () => {} },
      {
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        onClick: () => handleDeleteFromContext("service", svc.name, svc.namespace, refresh),
        variant: "destructive",
      },
    ];
  };

  return (
    <ResourceList
      title={t("navigation.services")}
      data={data}
      columns={columnsWithActions}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(svc) => svc.uid}
      getRowClassName={getRowClassName}
      getRowNamespace={(svc) => svc.namespace}
      emptyMessage={t("empty.services")}
      contextMenuItems={getServiceContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ConfigMapsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useConfigMaps({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getConfigMapContextMenu = (cm: ConfigMapInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("configmap", cm.name, cm.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(cm.name);
        toast.success("Copied to clipboard", { description: cm.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("configmap", cm.name, cm.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.configMaps")}
      data={data}
      columns={translateColumns(configMapColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(cm) => cm.uid}
      getRowNamespace={(cm) => cm.namespace}
      emptyMessage={t("empty.configmaps")}
      contextMenuItems={getConfigMapContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function SecretsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useSecrets({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getSecretContextMenu = (secret: SecretInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("secret", secret.name, secret.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(secret.name);
        toast.success("Copied to clipboard", { description: secret.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("secret", secret.name, secret.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.secrets")}
      data={data}
      columns={translateColumns(secretColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(s) => s.uid}
      getRowNamespace={(s) => s.namespace}
      emptyMessage={t("empty.secrets")}
      contextMenuItems={getSecretContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function NodesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useNodes({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getNodeContextMenu = (node: NodeInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("node", node.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(node.name);
        toast.success("Copied to clipboard", { description: node.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Cordon",
      icon: <AlertCircle className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Cordon ${node.name}` }),
      disabled: node.status !== "Ready",
    },
    {
      label: "Drain",
      icon: <Trash2 className="size-4" />,
      onClick: () => toast.info("Coming soon", { description: `Drain ${node.name}` }),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.nodes")}
      data={data}
      columns={translateColumns(nodeColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(node) => node.uid}
      emptyMessage={t("empty.nodes")}
      contextMenuItems={getNodeContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function NamespacesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useNamespaces({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getNamespaceContextMenu = (ns: { name: string; uid: string }): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("namespace", ns.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(ns.name);
        toast.success("Copied to clipboard", { description: ns.name });
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.namespaces")}
      data={data}
      columns={translateColumns(namespaceColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(ns) => ns.uid}
      getRowNamespace={(ns) => ns.name}
      emptyMessage={t("empty.namespaces")}
      contextMenuItems={getNamespaceContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function EventsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useEvents({
    autoRefresh: true,
    refreshInterval: 10000, // Events refresh every 10 seconds
  });
  const [sortKey, setSortKey] = useState<string | null>("last_timestamp");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter options for quick filtering
  const filterOptions: FilterOption<EventInfo>[] = [
    {
      key: "warning",
      label: "Warnings",
      predicate: (event) => event.event_type === "Warning",
      color: "yellow",
    },
    {
      key: "normal",
      label: "Normal",
      predicate: (event) => event.event_type === "Normal",
      color: "blue",
    },
  ];

  const getEventContextMenu = (event: EventInfo): ContextMenuItemDef[] => [
    {
      label: "View Involved Object",
      icon: <Eye className="size-4" />,
      onClick: () => {
        toast.info(`${event.involved_object.kind}: ${event.involved_object.name}`);
      },
    },
    {
      label: "Copy Message",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(event.message);
        toast.success("Copied to clipboard");
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.events")}
      data={data}
      columns={translateColumns(eventColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(event) => event.uid}
      getRowNamespace={(event) => event.namespace}
      emptyMessage={t("empty.events")}
      contextMenuItems={getEventContextMenu}
      filterOptions={filterOptions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function LeasesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useLeases({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const [sortKey, setSortKey] = useState<string | null>("namespace");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const getLeaseContextMenu = (lease: LeaseInfo): ContextMenuItemDef[] => [
    {
      label: "Copy Holder Identity",
      icon: <Copy className="size-4" />,
      onClick: () => {
        if (lease.holder_identity) {
          navigator.clipboard.writeText(lease.holder_identity);
          toast.success("Copied to clipboard", { description: lease.holder_identity });
        }
      },
      disabled: !lease.holder_identity,
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(lease.name);
        toast.success("Copied to clipboard", { description: lease.name });
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.leases")}
      data={data}
      columns={translateColumns(leaseColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(lease) => lease.uid}
      getRowNamespace={(lease) => lease.namespace}
      emptyMessage={t("empty.leases")}
      contextMenuItems={getLeaseContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ReplicaSetsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useReplicaSets({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getReplicaSetContextMenu = (rs: ReplicaSetInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("replicaset", rs.name, rs.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(rs.name);
        toast.success("Copied to clipboard", { description: rs.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("replicaset", rs.name, rs.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.replicaSets")}
      data={data}
      columns={translateColumns(replicaSetColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(rs) => rs.uid}
      getRowNamespace={(rs) => rs.namespace}
      emptyMessage={t("empty.replicasets")}
      contextMenuItems={getReplicaSetContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function DaemonSetsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useDaemonSets({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getDaemonSetContextMenu = (ds: DaemonSetInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("daemonset", ds.name, ds.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(ds.name);
        toast.success("Copied to clipboard", { description: ds.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("daemonset", ds.name, ds.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.daemonSets")}
      data={data}
      columns={translateColumns(daemonSetColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(ds) => ds.uid}
      getRowNamespace={(ds) => ds.namespace}
      emptyMessage={t("empty.daemonsets")}
      contextMenuItems={getDaemonSetContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function StatefulSetsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useStatefulSets({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getStatefulSetContextMenu = (sts: StatefulSetInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("statefulset", sts.name, sts.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(sts.name);
        toast.success("Copied to clipboard", { description: sts.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("statefulset", sts.name, sts.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.statefulSets")}
      data={data}
      columns={translateColumns(statefulSetColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(sts) => sts.uid}
      getRowNamespace={(sts) => sts.namespace}
      emptyMessage={t("empty.statefulsets")}
      contextMenuItems={getStatefulSetContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function JobsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useJobs({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter options for job status
  const filterOptions: FilterOption<JobInfo>[] = [
    {
      key: "complete",
      label: "Complete",
      predicate: (job) => job.status === "Complete",
      color: "green",
    },
    {
      key: "running",
      label: "Running",
      predicate: (job) => job.status === "Running",
      color: "blue",
    },
    {
      key: "failed",
      label: "Failed",
      predicate: (job) => job.status === "Failed",
      color: "red",
    },
  ];

  const getJobContextMenu = (job: JobInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("job", job.name, job.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(job.name);
        toast.success("Copied to clipboard", { description: job.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("job", job.name, job.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.jobs")}
      data={data}
      columns={translateColumns(jobColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(job) => job.uid}
      getRowNamespace={(job) => job.namespace}
      emptyMessage={t("empty.jobs")}
      contextMenuItems={getJobContextMenu}
      filterOptions={filterOptions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function CronJobsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useCronJobs({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Filter options for cronjob suspend status
  const filterOptions: FilterOption<CronJobInfo>[] = [
    {
      key: "active",
      label: "Active",
      predicate: (cj) => !cj.suspend,
      color: "green",
    },
    {
      key: "suspended",
      label: "Suspended",
      predicate: (cj) => cj.suspend,
      color: "yellow",
    },
  ];

  const getCronJobContextMenu = (cj: CronJobInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("cronjob", cj.name, cj.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(cj.name);
        toast.success("Copied to clipboard", { description: cj.name });
      },
    },
    {
      label: "Copy Schedule",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(cj.schedule);
        toast.success("Copied to clipboard", { description: cj.schedule });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("cronjob", cj.name, cj.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.cronJobs")}
      data={data}
      columns={translateColumns(cronJobColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(cj) => cj.uid}
      getRowNamespace={(cj) => cj.namespace}
      emptyMessage={t("empty.cronjobs")}
      contextMenuItems={getCronJobContextMenu}
      filterOptions={filterOptions}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

// Networking Views

function IngressesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useIngresses({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getIngressContextMenu = (ing: IngressInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("ingress", ing.name, ing.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(ing.name);
        toast.success("Copied to clipboard", { description: ing.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("ingress", ing.name, ing.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.ingresses")}
      data={data}
      columns={translateColumns(ingressColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(ing) => ing.uid}
      getRowNamespace={(ing) => ing.namespace}
      emptyMessage={t("empty.ingresses")}
      contextMenuItems={getIngressContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function EndpointSlicesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useEndpointSlices({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getEndpointSliceContextMenu = (es: EndpointSliceInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("endpointslice", es.name, es.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(es.name);
        toast.success("Copied to clipboard", { description: es.name });
      },
    },
  ];

  return (
    <ResourceList
      title={t("navigation.endpointSlices")}
      data={data}
      columns={translateColumns(endpointSliceColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(es) => es.uid}
      getRowNamespace={(es) => es.namespace}
      emptyMessage={t("empty.endpointslices")}
      contextMenuItems={getEndpointSliceContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function NetworkPoliciesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useNetworkPolicies({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getNetworkPolicyContextMenu = (np: NetworkPolicyInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("networkpolicy", np.name, np.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(np.name);
        toast.success("Copied to clipboard", { description: np.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("networkpolicy", np.name, np.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.networkPolicies")}
      data={data}
      columns={translateColumns(networkPolicyColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(np) => np.uid}
      getRowNamespace={(np) => np.namespace}
      emptyMessage={t("empty.networkpolicies")}
      contextMenuItems={getNetworkPolicyContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function IngressClassesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useIngressClasses({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getIngressClassContextMenu = (ic: IngressClassInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("ingressclass", ic.name, ""),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(ic.name);
        toast.success("Copied to clipboard", { description: ic.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("ingressclass", ic.name, "", refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.ingressClasses")}
      data={data}
      columns={translateColumns(ingressClassColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(ic) => ic.uid}
      getRowNamespace={() => ""}
      emptyMessage={t("empty.ingressclasses")}
      contextMenuItems={getIngressClassContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

// Configuration Views

function HPAsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useHPAs({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getHPAContextMenu = (hpa: HPAInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("hpa", hpa.name, hpa.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(hpa.name);
        toast.success("Copied to clipboard", { description: hpa.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("hpa", hpa.name, hpa.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.hpa")}
      data={data}
      columns={translateColumns(hpaColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(hpa) => hpa.uid}
      getRowNamespace={(hpa) => hpa.namespace}
      emptyMessage={t("empty.hpas")}
      contextMenuItems={getHPAContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function LimitRangesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useLimitRanges({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getLimitRangeContextMenu = (lr: LimitRangeInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("limitrange", lr.name, lr.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(lr.name);
        toast.success("Copied to clipboard", { description: lr.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("limitrange", lr.name, lr.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.limitRanges")}
      data={data}
      columns={translateColumns(limitRangeColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(lr) => lr.uid}
      getRowNamespace={(lr) => lr.namespace}
      emptyMessage={t("empty.limitranges")}
      contextMenuItems={getLimitRangeContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ResourceQuotasView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useResourceQuotas({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getResourceQuotaContextMenu = (rq: ResourceQuotaInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("resourcequota", rq.name, rq.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(rq.name);
        toast.success("Copied to clipboard", { description: rq.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("resourcequota", rq.name, rq.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.resourceQuotas")}
      data={data}
      columns={translateColumns(resourceQuotaColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(rq) => rq.uid}
      getRowNamespace={(rq) => rq.namespace}
      emptyMessage={t("empty.resourcequotas")}
      contextMenuItems={getResourceQuotaContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function PDBsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = usePDBs({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getPDBContextMenu = (pdb: PDBInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("pdb", pdb.name, pdb.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(pdb.name);
        toast.success("Copied to clipboard", { description: pdb.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("pdb", pdb.name, pdb.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.podDisruptionBudgets")}
      data={data}
      columns={translateColumns(pdbColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(pdb) => pdb.uid}
      getRowNamespace={(pdb) => pdb.namespace}
      emptyMessage={t("empty.pdbs")}
      contextMenuItems={getPDBContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

// =============================================================================
// Storage Views
// =============================================================================

function PersistentVolumesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = usePersistentVolumes({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getPVContextMenu = (pv: PVInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("persistentvolume", pv.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(pv.name);
        toast.success("Copied to clipboard", { description: pv.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("persistentvolume", pv.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.persistentVolumes")}
      data={data}
      columns={translateColumns(pvColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(pv) => pv.uid}
      emptyMessage={t("empty.pvs")}
      contextMenuItems={getPVContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function PersistentVolumeClaimsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = usePersistentVolumeClaims({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getPVCContextMenu = (pvc: PVCInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("persistentvolumeclaim", pvc.name, pvc.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(pvc.name);
        toast.success("Copied to clipboard", { description: pvc.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("persistentvolumeclaim", pvc.name, pvc.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.persistentVolumeClaims")}
      data={data}
      columns={translateColumns(pvcColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(pvc) => pvc.uid}
      getRowNamespace={(pvc) => pvc.namespace}
      emptyMessage={t("empty.pvcs")}
      contextMenuItems={getPVCContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function StorageClassesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useStorageClasses({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getSCContextMenu = (sc: StorageClassInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("storageclass", sc.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(sc.name);
        toast.success("Copied to clipboard", { description: sc.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("storageclass", sc.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.storageClasses")}
      data={data}
      columns={translateColumns(storageClassColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(sc) => sc.uid}
      emptyMessage={t("empty.storageclasses")}
      contextMenuItems={getSCContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function CSIDriversView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useCSIDrivers({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getDriverContextMenu = (driver: CSIDriverInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("csidriver", driver.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(driver.name);
        toast.success("Copied to clipboard", { description: driver.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("csidriver", driver.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.csiDrivers")}
      data={data}
      columns={translateColumns(csiDriverColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(driver) => driver.uid}
      emptyMessage={t("empty.csidrivers")}
      contextMenuItems={getDriverContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function CSINodesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useCSINodes({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getNodeContextMenu = (node: CSINodeInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("csinode", node.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(node.name);
        toast.success("Copied to clipboard", { description: node.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("csinode", node.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.csiNodes")}
      data={data}
      columns={translateColumns(csiNodeColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(node) => node.uid}
      emptyMessage={t("empty.csinodes")}
      contextMenuItems={getNodeContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function VolumeAttachmentsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useVolumeAttachments({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getVAContextMenu = (va: VolumeAttachmentInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("volumeattachment", va.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(va.name);
        toast.success("Copied to clipboard", { description: va.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("volumeattachment", va.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.volumeAttachments")}
      data={data}
      columns={translateColumns(volumeAttachmentColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(va) => va.uid}
      emptyMessage={t("empty.volumeattachments")}
      contextMenuItems={getVAContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

// =============================================================================
// Access Control Views
// =============================================================================

function ServiceAccountsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useServiceAccounts({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getSAContextMenu = (sa: ServiceAccountInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("serviceaccount", sa.name, sa.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(sa.name);
        toast.success("Copied to clipboard", { description: sa.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("serviceaccount", sa.name, sa.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.serviceAccounts")}
      data={data}
      columns={translateColumns(serviceAccountColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(sa) => sa.uid}
      getRowNamespace={(sa) => sa.namespace}
      emptyMessage={t("empty.serviceaccounts")}
      contextMenuItems={getSAContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function RolesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useRoles({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getRoleContextMenu = (role: RoleInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("role", role.name, role.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(role.name);
        toast.success("Copied to clipboard", { description: role.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("role", role.name, role.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.roles")}
      data={data}
      columns={translateColumns(roleColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(role) => role.uid}
      getRowNamespace={(role) => role.namespace}
      emptyMessage={t("empty.roles")}
      contextMenuItems={getRoleContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function RoleBindingsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useRoleBindings({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getRBContextMenu = (rb: RoleBindingInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("rolebinding", rb.name, rb.namespace),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(rb.name);
        toast.success("Copied to clipboard", { description: rb.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("rolebinding", rb.name, rb.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.roleBindings")}
      data={data}
      columns={translateColumns(roleBindingColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(rb) => rb.uid}
      getRowNamespace={(rb) => rb.namespace}
      emptyMessage={t("empty.rolebindings")}
      contextMenuItems={getRBContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ClusterRolesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useClusterRoles({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getCRContextMenu = (cr: ClusterRoleInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("clusterrole", cr.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(cr.name);
        toast.success("Copied to clipboard", { description: cr.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("clusterrole", cr.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.clusterRoles")}
      data={data}
      columns={translateColumns(clusterRoleColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(cr) => cr.uid}
      emptyMessage={t("empty.clusterroles")}
      contextMenuItems={getCRContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ClusterRoleBindingsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useClusterRoleBindings({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getCRBContextMenu = (crb: ClusterRoleBindingInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("clusterrolebinding", crb.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(crb.name);
        toast.success("Copied to clipboard", { description: crb.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("clusterrolebinding", crb.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.clusterRoleBindings")}
      data={data}
      columns={translateColumns(clusterRoleBindingColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(crb) => crb.uid}
      emptyMessage={t("empty.clusterrolebindings")}
      contextMenuItems={getCRBContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

// =============================================================================
// Administration Views
// =============================================================================

function CRDsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useCRDs({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getCRDContextMenu = (crd: CRDInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("customresourcedefinition", crd.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(crd.name);
        toast.success("Copied to clipboard", { description: crd.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("customresourcedefinition", crd.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.crds")}
      data={data}
      columns={translateColumns(crdColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(crd) => crd.uid}
      emptyMessage={t("empty.crds")}
      contextMenuItems={getCRDContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function PriorityClassesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = usePriorityClasses({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("value");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getPCContextMenu = (pc: PriorityClassInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("priorityclass", pc.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(pc.name);
        toast.success("Copied to clipboard", { description: pc.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("priorityclass", pc.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.priorityClasses")}
      data={data}
      columns={translateColumns(priorityClassColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(pc) => pc.uid}
      emptyMessage={t("empty.priorityclasses")}
      contextMenuItems={getPCContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function RuntimeClassesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useRuntimeClasses({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getRCContextMenu = (rc: RuntimeClassInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("runtimeclass", rc.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(rc.name);
        toast.success("Copied to clipboard", { description: rc.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("runtimeclass", rc.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.runtimeClasses")}
      data={data}
      columns={translateColumns(runtimeClassColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(rc) => rc.uid}
      emptyMessage={t("empty.runtimeclasses")}
      contextMenuItems={getRCContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function MutatingWebhooksView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useMutatingWebhooks({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getMWContextMenu = (mw: MutatingWebhookInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("mutatingwebhookconfiguration", mw.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(mw.name);
        toast.success("Copied to clipboard", { description: mw.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("mutatingwebhookconfiguration", mw.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.mutatingWebhooks")}
      data={data}
      columns={translateColumns(mutatingWebhookColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(mw) => mw.uid}
      emptyMessage={t("empty.mutatingwebhooks")}
      contextMenuItems={getMWContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ValidatingWebhooksView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useValidatingWebhooks({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getVWContextMenu = (vw: ValidatingWebhookInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("validatingwebhookconfiguration", vw.name),
    },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(vw.name);
        toast.success("Copied to clipboard", { description: vw.name });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("validatingwebhookconfiguration", vw.name, undefined, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title={t("navigation.validatingWebhooks")}
      data={data}
      columns={translateColumns(validatingWebhookColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      getRowKey={(vw) => vw.uid}
      emptyMessage={t("empty.validatingwebhooks")}
      contextMenuItems={getVWContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function HelmReleasesView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useHelmReleases({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext, handleUninstallFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("last_deployed");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getHelmContextMenu = (release: HelmReleaseInfo): ContextMenuItemDef[] => {
    const items: ContextMenuItemDef[] = [];

    // View Details for all releases (different resource type based on managed_by)
    items.push({
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail(
        release.managed_by === "flux" ? "helmrelease" : "helm-release",
        release.name,
        release.namespace
      ),
    });

    // Flux-specific actions
    if (release.managed_by === "flux") {
      items.push({ separator: true, label: "", onClick: () => {} });
      items.push({
        label: "Reconcile",
        icon: <RefreshCw className="size-4" />,
        onClick: async () => {
          try {
            await reconcileFluxHelmRelease(release.name, release.namespace);
            toast.success("Reconciliation triggered", { description: release.name });
            refresh();
          } catch (e) {
            toast.error("Failed to trigger reconciliation", { description: String(e) });
          }
        },
      });
      items.push(
        release.suspended
          ? {
              label: "Resume",
              icon: <Play className="size-4" />,
              onClick: async () => {
                try {
                  await resumeFluxHelmRelease(release.name, release.namespace);
                  toast.success("HelmRelease resumed", { description: release.name });
                  refresh();
                } catch (e) {
                  toast.error("Failed to resume", { description: String(e) });
                }
              },
            }
          : {
              label: "Suspend",
              icon: <Pause className="size-4" />,
              onClick: async () => {
                try {
                  await suspendFluxHelmRelease(release.name, release.namespace);
                  toast.success("HelmRelease suspended", { description: release.name });
                  refresh();
                } catch (e) {
                  toast.error("Failed to suspend", { description: String(e) });
                }
              },
            }
      );
    }

    items.push({ separator: true, label: "", onClick: () => {} });
    items.push(
      {
        label: "Copy Name",
        icon: <Copy className="size-4" />,
        onClick: () => {
          navigator.clipboard.writeText(release.name);
          toast.success("Copied to clipboard", { description: release.name });
        },
      },
      {
        label: "Copy Chart",
        icon: <Copy className="size-4" />,
        onClick: () => {
          const chartInfo = `${release.chart}-${release.chart_version}`;
          navigator.clipboard.writeText(chartInfo);
          toast.success("Copied to clipboard", { description: chartInfo });
        },
      }
    );

    // Delete/Uninstall
    items.push({ separator: true, label: "", onClick: () => {} });
    if (release.managed_by === "flux") {
      items.push({
        label: "Delete",
        icon: <Trash2 className="size-4" />,
        onClick: () => handleDeleteFromContext("helmrelease", release.name, release.namespace, refresh),
        variant: "destructive",
      });
    } else {
      items.push({
        label: "Uninstall",
        icon: <Trash2 className="size-4" />,
        onClick: () => handleUninstallFromContext(release.name, release.namespace, refresh),
        variant: "destructive",
      });
    }

    return items;
  };

  return (
    <ResourceList
      title={t("navigation.releases")}
      data={data}
      columns={translateColumns(helmReleaseColumns, t)}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRowClick={(r) => openResourceDetail(r.managed_by === "flux" ? "helmrelease" : "helm-release", r.name, r.namespace)}
      getRowKey={(r) => `${r.namespace}/${r.name}`}
      getRowNamespace={(r) => r.namespace}
      emptyMessage={t("empty.helmreleases")}
      contextMenuItems={getHelmContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function FluxKustomizationsView() {
  const t = useTranslations();
  const { data, isLoading, error, refresh } = useFluxKustomizations({
    autoRefresh: true,
    refreshInterval: 30000,
  });
  const { openResourceDetail, handleDeleteFromContext } = useResourceDetail();
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const getKustomizationContextMenu = (k: FluxKustomizationInfo): ContextMenuItemDef[] => [
    {
      label: "View Details",
      icon: <Eye className="size-4" />,
      onClick: () => openResourceDetail("kustomization", k.name, k.namespace),
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Reconcile",
      icon: <RefreshCw className="size-4" />,
      onClick: async () => {
        try {
          await reconcileFluxKustomization(k.name, k.namespace);
          toast.success("Reconciliation triggered", { description: k.name });
          refresh();
        } catch (e) {
          toast.error("Failed to trigger reconciliation", { description: String(e) });
        }
      },
    },
    k.suspended
      ? {
          label: "Resume",
          icon: <Play className="size-4" />,
          onClick: async () => {
            try {
              await resumeFluxKustomization(k.name, k.namespace);
              toast.success("Kustomization resumed", { description: k.name });
              refresh();
            } catch (e) {
              toast.error("Failed to resume", { description: String(e) });
            }
          },
        }
      : {
          label: "Suspend",
          icon: <Pause className="size-4" />,
          onClick: async () => {
            try {
              await suspendFluxKustomization(k.name, k.namespace);
              toast.success("Kustomization suspended", { description: k.name });
              refresh();
            } catch (e) {
              toast.error("Failed to suspend", { description: String(e) });
            }
          },
        },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Copy Name",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.name);
        toast.success("Copied to clipboard", { description: k.name });
      },
    },
    {
      label: "Copy Path",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.path);
        toast.success("Copied to clipboard", { description: k.path });
      },
    },
    {
      label: "Copy Source",
      icon: <Copy className="size-4" />,
      onClick: () => {
        navigator.clipboard.writeText(k.source_ref);
        toast.success("Copied to clipboard", { description: k.source_ref });
      },
    },
    { separator: true, label: "", onClick: () => {} },
    {
      label: "Delete",
      icon: <Trash2 className="size-4" />,
      onClick: () => handleDeleteFromContext("kustomization", k.name, k.namespace, refresh),
      variant: "destructive",
    },
  ];

  return (
    <ResourceList
      title="Kustomizations"
      data={data}
      columns={fluxKustomizationColumns}
      isLoading={isLoading}
      error={error}
      onRefresh={refresh}
      onRowClick={(k) => openResourceDetail("kustomization", k.name, k.namespace)}
      getRowKey={(k) => `${k.namespace}/${k.name}`}
      getRowNamespace={(k) => k.namespace}
      emptyMessage="No Flux Kustomizations found"
      contextMenuItems={getKustomizationContextMenu}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSortChange={(key, dir) => { setSortKey(key); setSortDirection(dir); }}
    />
  );
}

function ComingSoon({ resource }: { resource: string }) {
  const title = resource
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="rounded-2xl bg-muted p-6">
        <Box className="size-16 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground">This view is coming soon.</p>
    </div>
  );
}
