"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Sidebar, type ResourceType } from "@/components/layout/Sidebar";
import { ResourceDetail, type ResourceData } from "../resources/ResourceDetail";
import { CreateResourcePanel } from "../resources/CreateResourcePanel";
import { AIAssistant } from "../ai/AIAssistant";
import { TerminalTabsProvider, useTerminalTabs } from "../terminal";
import { SettingsPanel } from "../settings/SettingsPanel";
import { BrowserOpenDialog } from "../portforward/BrowserOpenDialog";
import { RestartDialog } from "../updates/RestartDialog";
import { useTabTitle } from "@/components/layout/TabBar";
import { ShortcutsHelpDialog } from "../shortcuts/ShortcutsHelpDialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { useClusterStore } from "@/lib/stores/cluster-store";
import {
  useFavoritesStore,
  type FavoriteResource,
} from "@/lib/stores/favorites-store";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAIStore } from "@/lib/stores/ai-store";
import { useDeepLinkNavigation } from "@/lib/hooks/useDeepLinkNavigation";
import { toast } from "sonner";
import {
  getResourceYaml,
  applyResourceYaml,
  deleteResource,
  listEvents,
  aiCheckCliAvailable,
  aiCheckCodexCliAvailable,
} from "@/lib/tauri/commands";

import {
  ResourceDetailContext,
  type OpenResourceDetailResult,
} from "./context";
import { DashboardMainWorkspace } from "./components";
import {
  DeleteConfirmDialog,
  UninstallHelmDialog,
  ScaleDeploymentDialog,
  type DeleteDialogState,
  type UninstallDialogState,
  type ScaleDialogState,
} from "./dialogs";
import { useDashboardShortcuts } from "./hooks/useDashboardShortcuts";

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

function toFavoriteResourceType(resourceType: string): string | null {
  switch (resourceType) {
    case "pod":
    case "pods":
      return "pods";
    case "deployment":
    case "deployments":
      return "deployments";
    case "service":
    case "services":
      return "services";
    default:
      return null;
  }
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("NotFound") || message.includes("not found");
}

function DashboardContent() {
  useDeepLinkNavigation();
  const t = useTranslations();
  const { tabs: resourceTabs, activeTabId, navigateCurrentTab, openTab, closeTab, setActiveTab, restoreTabs } = useTabsStore();
  const getTabTitle = useTabTitle();
  const activeTab = resourceTabs.find((t) => t.id === activeTabId) || resourceTabs[0];
  const activeResource = activeTab?.type ?? "cluster-overview";
  const setActiveResource = useCallback(
    (type: ResourceType) => {
      navigateCurrentTab(type, getTabTitle(type));
    },
    [navigateCurrentTab, getTabTitle]
  );
  const { isConnected, currentCluster, setCurrentNamespace } = useClusterStore();
  const { tabs, isOpen, closePanel } = useTerminalTabs();
  const [selectedResource, setSelectedResource] = useState<{ data: ResourceData; type: string } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [uninstallDialog, setUninstallDialog] = useState<UninstallDialogState | null>(null);
  const [scaleDialog, setScaleDialog] = useState<ScaleDialogState | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { getFavorites, removeFavorite } = useFavoritesStore();
  const { setSettingsOpen, isAIAssistantOpen, toggleAIAssistant, pendingPodLogs, triggerRefresh, triggerSearchFocus, isCreateResourceOpen, setCreateResourceOpen } = useUIStore();
  const { isThinking, isStreaming } = useAIStore();
  const isAIProcessing = isThinking || isStreaming;
  const detailRequestIdRef = useRef(0);

  // AI CLI availability check
  const [isAICliAvailable, setIsAICliAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAiClis = async () => {
      try {
        const [claudeInfo, codexInfo] = await Promise.all([
          aiCheckCliAvailable().catch(() => ({ status: "error" as const })),
          aiCheckCodexCliAvailable().catch(() => ({ status: "error" as const })),
        ]);
        const claudeAvailable = claudeInfo.status === "authenticated";
        const codexAvailable = codexInfo.status === "authenticated";
        setIsAICliAvailable(claudeAvailable || codexAvailable);
      } catch {
        setIsAICliAvailable(false);
      }
    };
    checkAiClis();
  }, []);

  const clusterContext = currentCluster?.context || "";
  const favorites = getFavorites(clusterContext);
  const activeFavoriteId = useMemo(() => {
    if (activeResource === "pod-logs") {
      const podName = activeTab?.metadata?.podName;
      const namespace = activeTab?.metadata?.namespace;
      if (!podName || !namespace) return null;
      return (
        favorites.find(
          (f) =>
            f.resourceType === "pods" &&
            f.name === podName &&
            f.namespace === namespace
        )?.id ?? null
      );
    }

    if (!selectedResource) return null;
    const favoriteType = toFavoriteResourceType(selectedResource.type);
    if (!favoriteType) return null;
    return (
      favorites.find(
        (f) =>
          f.resourceType === favoriteType &&
          f.name === selectedResource.data.name &&
          f.namespace === selectedResource.data.namespace
      )?.id ?? null
    );
  }, [activeResource, activeTab, favorites, selectedResource]);

  // Restore tabs when cluster connects
  useEffect(() => {
    if (isConnected && clusterContext) {
      restoreTabs(clusterContext);
    }
  }, [isConnected, clusterContext, restoreTabs]);

  // Watch for pending pod logs navigation from AI assistant
  useEffect(() => {
    if (pendingPodLogs) {
      setActiveResource("pods");
    }
  }, [pendingPodLogs, setActiveResource]);

  const openResourceDetail = useCallback(
    async (
      resourceType: string,
      name: string,
      namespace?: string
    ): Promise<OpenResourceDetailResult> => {
      setCreateResourceOpen(false);
      const requestId = ++detailRequestIdRef.current;
      try {
        const [yamlData, events] = await Promise.all([
          getResourceYaml(resourceType, name, namespace),
          namespace
            ? listEvents({
                namespace,
                field_selector: `involvedObject.name=${name}`,
              }).catch(() => [])
            : Promise.resolve([]),
        ]);

        if (requestId !== detailRequestIdRef.current) {
          return "stale";
        }

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
            events: events.map((e) => ({
              type: e.event_type,
              reason: e.reason,
              message: e.message,
              count: e.count,
              lastTimestamp: e.last_timestamp ?? undefined,
              firstTimestamp: e.first_timestamp ?? undefined,
            })),
          },
        });
        return "success";
      } catch (err) {
        if (requestId !== detailRequestIdRef.current) {
          return "stale";
        }
        if (isNotFoundError(err)) {
          return "not_found";
        }
        console.error("Failed to load resource details:", err);
        return "error";
      }
    },
    [setCreateResourceOpen]
  );

  const removeMissingFavorite = useCallback(
    (favorite: FavoriteResource) => {
      removeFavorite(clusterContext, favorite.id);
      toast.info(t("favorites.removedMissingResource"), {
        description: t("favorites.removedMissingResourceDescription", {
          name: favorite.name,
        }),
      });
    },
    [clusterContext, removeFavorite, t]
  );

  const handleFavoriteSelect = useCallback(
    async (favorite: FavoriteResource) => {
      setCurrentNamespace("");

      setActiveResource(favorite.resourceType as ResourceType);

      const result = await openResourceDetail(
        favorite.resourceType,
        favorite.name,
        favorite.namespace
      );
      if (result === "not_found") {
        removeMissingFavorite(favorite);
      }
    },
    [
      openResourceDetail,
      removeMissingFavorite,
      setActiveResource,
      setCurrentNamespace,
    ]
  );

  const handleFavoriteOpenLogs = useCallback(
    async (favorite: FavoriteResource) => {
      if (favorite.resourceType !== "pods" || !favorite.namespace) {
        return;
      }

      setCurrentNamespace("");
      setActiveResource("pods");

      try {
        await getResourceYaml("pods", favorite.name, favorite.namespace);
      } catch (error) {
        if (isNotFoundError(error)) {
          removeMissingFavorite(favorite);
        } else {
          console.error("Failed to resolve favorite pod logs target:", error);
        }
        return;
      }

      if (resourceTabs.length >= 10) {
        toast.warning(t("tabs.limitToast"));
        return;
      }

      openTab("pod-logs", `Logs: ${favorite.name} (${favorite.namespace})`, {
        newTab: true,
        metadata: { namespace: favorite.namespace, podName: favorite.name },
      });
    },
    [
      openTab,
      removeMissingFavorite,
      resourceTabs.length,
      setActiveResource,
      setCurrentNamespace,
      t,
    ]
  );

  // Navigate to favorite by index
  const navigateToFavorite = useCallback((index: number) => {
    if (index < favorites.length) {
      const fav = favorites[index];
      void handleFavoriteSelect(fav);
    }
  }, [favorites, handleFavoriteSelect]);

  const openCreateResource = useCallback(() => {
    setSelectedResource(null);
    setCreateResourceOpen(true);
  }, [setCreateResourceOpen]);

  useDashboardShortcuts({
    enabled: isConnected,
    activeTabId,
    isAICliAvailable,
    resourceTabs,
    tabLimitToast: t("tabs.limitToast"),
    closeTab,
    getTabTitle,
    navigateToFavorite,
    openCreateResource,
    openShortcutsHelp: () => setShowShortcutsHelp(true),
    openTab,
    setActiveResource,
    setActiveTab,
    toggleAIAssistant,
    triggerRefresh,
    triggerSearchFocus,
  });

  const handleSaveResource = async (yaml: string) => {
    await applyResourceYaml(yaml);
    if (selectedResource) {
      await openResourceDetail(
        selectedResource.type,
        selectedResource.data.name,
        selectedResource.data.namespace
      );
    }
  };

  const { triggerResourceDeleteRefresh } = useUIStore();

  const handleDeleteResource = async () => {
    if (!selectedResource) return;
    await deleteResource(
      selectedResource.type,
      selectedResource.data.name,
      selectedResource.data.namespace
    );
    closeResourceDetail();
    triggerResourceDeleteRefresh();
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
    setScaleDialog({ open: true, name, namespace, currentReplicas, onSuccess });
  };

  const closeResourceDetail = useCallback(() => {
    detailRequestIdRef.current += 1;
    setSelectedResource(null);
  }, []);

  return (
    <ResourceDetailContext.Provider
      value={{
        selectedResource,
        setSelectedResource,
        openResourceDetail,
        handleDeleteFromContext,
        handleUninstallFromContext,
        handleScaleFromContext,
        closeResourceDetail,
      }}
    >
      <div className="flex h-screen bg-background text-foreground overscroll-none">
        <Sidebar
          activeResource={activeResource}
          activeFavoriteId={activeFavoriteId}
          onResourceSelect={setActiveResource}
          onFavoriteSelect={handleFavoriteSelect}
          onFavoriteOpenLogs={handleFavoriteOpenLogs}
          onResourceSelectNewTab={(type) => {
            if (resourceTabs.length >= 10) {
              toast.warning(t("tabs.limitToast"));
              return;
            }
            openTab(type, getTabTitle(type), { newTab: true });
          }}
        />
        <div className="flex flex-1 overflow-hidden overscroll-none">
          <ResizablePanelGroup orientation="horizontal" id="detail-panel">
            <DashboardMainWorkspace
              activeResource={activeResource}
              isAIAssistantOpen={isAIAssistantOpen}
              isAIProcessing={isAIProcessing}
              isAIDisabled={isAICliAvailable === false}
              isConnected={isConnected}
              isCreateResourceOpen={isCreateResourceOpen}
              isTerminalOpen={isOpen}
              terminalTabCount={tabs.length}
              terminalTitle={t("terminal.title")}
              onCloseTerminal={closePanel}
              onOpenCreateResource={() => {
                closeResourceDetail();
                openCreateResource();
              }}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
              onToggleAI={toggleAIAssistant}
            />
            {(selectedResource || isCreateResourceOpen) && <ResizableHandle withHandle />}
            {(selectedResource || isCreateResourceOpen) && (
              <ResizablePanel id="detail-panel-content" defaultSize="700px" minSize="500px" maxSize="65%">
                <div className="h-full border-l border-border overflow-hidden">
                  {isCreateResourceOpen ? (
                    <CreateResourcePanel
                      onClose={() => setCreateResourceOpen(false)}
                      onApplied={triggerRefresh}
                    />
                  ) : selectedResource ? (
                    <ResourceDetail
                      resource={selectedResource.data}
                      resourceType={selectedResource.type}
                      onClose={closeResourceDetail}
                      onSave={handleSaveResource}
                      onDelete={handleDeleteResource}
                    />
                  ) : null}
                </div>
              </ResizablePanel>
            )}
          {isAIAssistantOpen && <ResizableHandle withHandle />}
            {isAIAssistantOpen && (
              <ResizablePanel id="ai-assistant-panel" defaultSize="400px" minSize="400px" maxSize="50%">
                <div className="h-full border-l border-border overflow-auto">
                  <AIAssistant />
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
        </div>

        {/* Dialogs */}
        <DeleteConfirmDialog state={deleteDialog} onClose={() => setDeleteDialog(null)} />
        <UninstallHelmDialog state={uninstallDialog} onClose={() => setUninstallDialog(null)} />
        <ScaleDeploymentDialog state={scaleDialog} onClose={() => setScaleDialog(null)} />
        <ShortcutsHelpDialog open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
      </div>
    </ResourceDetailContext.Provider>
  );
}
