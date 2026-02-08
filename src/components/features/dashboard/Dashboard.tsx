"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Sidebar, type ResourceType } from "@/components/layout/Sidebar";
import { ResourceDetail, type ResourceData } from "../resources/ResourceDetail";
import { AIAssistant } from "../ai/AIAssistant";
import { TerminalTabsProvider, useTerminalTabs, TerminalTabs } from "../terminal";
import { SettingsPanel } from "../settings/SettingsPanel";
import { BrowserOpenDialog } from "../portforward/BrowserOpenDialog";
import { RestartDialog } from "../updates/RestartDialog";
import { Titlebar } from "@/components/layout/Titlebar";
import { TabBar, useTabTitle } from "@/components/layout/TabBar";
import { ShortcutsHelpDialog } from "../shortcuts/ShortcutsHelpDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/lib/stores/cluster-store";
import {
  useFavoritesStore,
  type FavoriteResource,
} from "@/lib/stores/favorites-store";
import { useTabsStore } from "@/lib/stores/tabs-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAIStore } from "@/lib/stores/ai-store";
import { useKeyboardShortcuts, NAVIGATION_SHORTCUTS } from "@/lib/hooks/useKeyboardShortcuts";
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
import { ResourceView } from "./views";
import { NotConnectedState } from "./components";
import {
  DeleteConfirmDialog,
  UninstallHelmDialog,
  ScaleDeploymentDialog,
  type DeleteDialogState,
  type UninstallDialogState,
  type ScaleDialogState,
} from "./dialogs";

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
  const { tabs, isOpen, setIsOpen } = useTerminalTabs();
  const [selectedResource, setSelectedResource] = useState<{ data: ResourceData; type: string } | null>(null);

  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [uninstallDialog, setUninstallDialog] = useState<UninstallDialogState | null>(null);
  const [scaleDialog, setScaleDialog] = useState<ScaleDialogState | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { getFavorites, removeFavorite } = useFavoritesStore();
  const { setSettingsOpen, isAIAssistantOpen, toggleAIAssistant, pendingPodLogs, triggerRefresh, triggerSearchFocus } = useUIStore();
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
    []
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
    { key: NAVIGATION_SHORTCUTS.FOCUS_SEARCH, handler: () => triggerSearchFocus(), description: "Focus search" },
    { key: NAVIGATION_SHORTCUTS.REFRESH, handler: () => triggerRefresh(), description: "Refresh view" },
    { key: NAVIGATION_SHORTCUTS.HELP, handler: () => setShowShortcutsHelp(true), description: "Show shortcuts help" },
    { key: NAVIGATION_SHORTCUTS.TOGGLE_AI, handler: () => { if (isAICliAvailable !== false) toggleAIAssistant(); }, description: "Toggle AI Assistant" },
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
    // Tab shortcuts
    { key: "t", meta: true, handler: () => { if (resourceTabs.length < 10) openTab("cluster-overview", getTabTitle("cluster-overview"), { newTab: true }); }, description: "New tab", global: true },
    { key: "w", meta: true, handler: () => { if (resourceTabs.length > 1) closeTab(activeTabId); }, description: "Close current tab", global: true },
    { key: "Tab", meta: true, handler: () => {
      const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
      const nextIdx = (idx + 1) % resourceTabs.length;
      setActiveTab(resourceTabs[nextIdx].id);
    }, description: "Next tab", global: true },
    { key: "Tab", meta: true, shift: true, handler: () => {
      const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
      const prevIdx = (idx - 1 + resourceTabs.length) % resourceTabs.length;
      setActiveTab(resourceTabs[prevIdx].id);
    }, description: "Previous tab", global: true },
  ], [navigateToFavorite, toggleAIAssistant, isAICliAvailable, resourceTabs, activeTabId, openTab, getTabTitle, closeTab, setActiveTab, setActiveResource, triggerRefresh, triggerSearchFocus]);

  useKeyboardShortcuts(shortcuts, { enabled: isConnected });

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
          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Titlebar
              isAIOpen={isAIAssistantOpen}
              isAIProcessing={isAIProcessing}
              isAIDisabled={isAICliAvailable === false}
              onToggleAI={toggleAIAssistant}
              onOpenShortcutsHelp={() => setShowShortcutsHelp(true)}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            {isConnected && <TabBar />}
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
                    <Button variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)}>
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
                onClose={closeResourceDetail}
                onSave={handleSaveResource}
                onDelete={handleDeleteResource}
              />
            </div>
          )}

          {/* AI Assistant Panel */}
          {isAIAssistantOpen && (
            <div
              className="min-w-[300px] max-w-[600px] border-l border-border flex-shrink-0 overflow-auto"
              style={{ width: 400, resize: "horizontal", direction: "rtl" }}
            >
              <div style={{ direction: "ltr" }} className="h-full">
                <AIAssistant />
              </div>
            </div>
          )}
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
