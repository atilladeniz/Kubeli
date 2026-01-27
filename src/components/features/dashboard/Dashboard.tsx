"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import { ShortcutsHelpDialog } from "../shortcuts/ShortcutsHelpDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useAIStore } from "@/lib/stores/ai-store";
import { useKeyboardShortcuts, NAVIGATION_SHORTCUTS } from "@/lib/hooks/useKeyboardShortcuts";
import {
  getResourceYaml,
  applyResourceYaml,
  deleteResource,
  aiCheckCliAvailable,
  aiCheckCodexCliAvailable,
} from "@/lib/tauri/commands";

import { ResourceDetailContext } from "./context";
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

function DashboardContent() {
  const t = useTranslations();
  const [activeResource, setActiveResource] = useState<ResourceType>("cluster-overview");
  const { isConnected, currentCluster } = useClusterStore();
  const { tabs, isOpen, setIsOpen } = useTerminalTabs();
  const [selectedResource, setSelectedResource] = useState<{ data: ResourceData; type: string } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);
  const [uninstallDialog, setUninstallDialog] = useState<UninstallDialogState | null>(null);
  const [scaleDialog, setScaleDialog] = useState<ScaleDialogState | null>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { getFavorites } = useFavoritesStore();
  const { setSettingsOpen, isAIAssistantOpen, toggleAIAssistant, pendingPodLogs } = useUIStore();
  const { isThinking, isStreaming } = useAIStore();
  const isAIProcessing = isThinking || isStreaming;

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

  // Watch for pending pod logs navigation from AI assistant
  useEffect(() => {
    if (pendingPodLogs) {
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
  ], [navigateToFavorite, toggleAIAssistant, isAICliAvailable]);

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
    setScaleDialog({ open: true, name, namespace, currentReplicas, onSuccess });
  };

  const closeResourceDetail = () => {
    setSelectedResource(null);
  };

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
        <Sidebar activeResource={activeResource} onResourceSelect={setActiveResource} />
        <div className="flex flex-1 overflow-hidden overscroll-none">
          {/* Main content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <Titlebar
              isAIOpen={isAIAssistantOpen}
              isAIProcessing={isAIProcessing}
              isAIDisabled={isAICliAvailable === false}
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
                onClose={() => setSelectedResource(null)}
                onSave={handleSaveResource}
                onDelete={handleDeleteResource}
                isLoading={isLoadingDetail}
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
