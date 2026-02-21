"use client";

import { useCallback, useMemo, useState } from "react";
import { usePlatform } from "@/lib/hooks/usePlatform";
import { useTranslations } from "next-intl";

import { Layers, Cog } from "lucide-react";
import { ConfigureNamespacesDialog } from "@/components/features/home/components/ConfigureNamespacesDialog";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { ClusterIcon } from "@/components/ui/cluster-icon";
import { useUIStore } from "@/lib/stores/ui-store";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { useFavoritesStore } from "@/lib/stores/favorites-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  FavoritesSection,
  NavSectionCollapsible,
  NamespaceSection,
  PortForwardsSection,
  QuickAccessSection,
  RecentSection,
  useNavigationSections,
  useSidebarUiState,
  type ResourceType,
  type SidebarProps,
} from "./index";

export type { ResourceType } from "./index";

export function Sidebar({
  activeResource,
  activeFavoriteId,
  onResourceSelect,
  onResourceSelectNewTab,
  onFavoriteSelect,
  onFavoriteOpenLogs,
}: SidebarProps) {
  const tNav = useTranslations("navigation");
  const tCluster = useTranslations("cluster");

  const {
    currentCluster,
    selectedNamespaces,
    namespaces,
    namespaceSource,
    toggleNamespace,
    selectAllNamespaces,
    isConnected,
    disconnect,
    latencyMs,
    isReconnecting,
    reconnectAttempts,
    isHealthy,
    saveAccessibleNamespaces,
    clearAccessibleNamespaces,
  } = useClusterStore();

  const [configureNsOpen, setConfigureNsOpen] = useState(false);
  const handleConfigureNamespaces = useCallback(() => setConfigureNsOpen(true), []);

  const { setSettingsOpen } = useUIStore();
  const { forwards, stopForward } = usePortForward();
  const { getFavorites, removeFavorite, getRecentResources } =
    useFavoritesStore();
  const {
    namespaceOpen,
    setNamespaceOpen,
    isNamespaceSectionOpen,
    setIsNamespaceSectionOpen,
    isPortForwardsSectionOpen,
    setIsPortForwardsSectionOpen,
    isFavoritesSectionOpen,
    setIsFavoritesSectionOpen,
    isRecentSectionOpen,
    setIsRecentSectionOpen,
    isNavFavoritesSectionOpen,
    setIsNavFavoritesSectionOpen,
    navFavorites,
    isNavFavorite,
    toggleNavFavorite,
  } = useSidebarUiState();
  const navigationSections = useNavigationSections();
  const { modKeySymbol } = usePlatform();

  const clusterContext = currentCluster?.context || "";
  const favorites = getFavorites(clusterContext);
  const recentResources = getRecentResources(clusterContext).slice(0, 5);
  const navLabelById = useMemo(() => {
    const map = new Map<ResourceType, string>();
    for (const section of navigationSections) {
      for (const item of section.items) {
        map.set(item.id, item.label);
      }
    }
    return map;
  }, [navigationSections]);
  const handleOpenForwardInBrowser = async (port: number) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${port}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
      window.open(`http://localhost:${port}`, "_blank");
    }
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card/50 overflow-hidden">
      {/* Traffic lights safe area */}
      <div data-tauri-drag-region className="h-8 shrink-0" />

      {/* Cluster Context - Clickable to disconnect */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={disconnect}
              className="mx-3 mb-3 flex w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-border/70 bg-muted/50 px-3 py-2 text-left transition-colors hover:border-border hover:bg-muted"
            >
              {currentCluster ? (
                <ClusterIcon cluster={currentCluster} size={20} />
              ) : (
                <Layers className="size-5 text-primary" />
              )}
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {currentCluster?.name || tCluster("noCluster")}
                </p>
              </div>
              {isConnected && isHealthy && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {latencyMs !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      {latencyMs}ms
                    </span>
                  )}
                  <span className="size-2 rounded-full bg-green-400" />
                </div>
              )}
              {isConnected && !isHealthy && !isReconnecting && (
                <span className="size-2 shrink-0 rounded-full bg-yellow-400" />
              )}
              {isReconnecting && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    Retry {reconnectAttempts}
                  </span>
                  <span className="size-2 rounded-full bg-yellow-400 animate-pulse" />
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>
              {isReconnecting
                ? `Reconnecting (attempt ${reconnectAttempts})...`
                : isConnected && !isHealthy
                ? "Connection unhealthy"
                : isConnected
                ? `Connected${latencyMs ? ` (${latencyMs}ms)` : ""}`
                : "Click to switch cluster"}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator />

      <NamespaceSection
        isConnected={isConnected}
        namespaces={namespaces}
        selectedNamespaces={selectedNamespaces}
        namespaceSource={namespaceSource}
        namespaceOpen={namespaceOpen}
        isNamespaceSectionOpen={isNamespaceSectionOpen}
        setNamespaceOpen={setNamespaceOpen}
        setIsNamespaceSectionOpen={setIsNamespaceSectionOpen}
        toggleNamespace={toggleNamespace}
        selectAllNamespaces={selectAllNamespaces}
        onConfigureNamespaces={handleConfigureNamespaces}
      />

      <PortForwardsSection
        isConnected={isConnected}
        forwards={forwards}
        isPortForwardsSectionOpen={isPortForwardsSectionOpen}
        setIsPortForwardsSectionOpen={setIsPortForwardsSectionOpen}
        onResourceSelect={onResourceSelect}
        onOpenForwardInBrowser={handleOpenForwardInBrowser}
        stopForward={stopForward}
      />

      <FavoritesSection
        isConnected={isConnected}
        favorites={favorites}
        activeFavoriteId={activeFavoriteId}
        clusterContext={clusterContext}
        isFavoritesSectionOpen={isFavoritesSectionOpen}
        setIsFavoritesSectionOpen={setIsFavoritesSectionOpen}
        modKeySymbol={modKeySymbol}
        onResourceSelect={onResourceSelect}
        onFavoriteSelect={onFavoriteSelect}
        onFavoriteOpenLogs={onFavoriteOpenLogs}
        removeFavorite={removeFavorite}
      />

      <RecentSection
        isConnected={isConnected}
        recentResources={recentResources}
        isRecentSectionOpen={isRecentSectionOpen}
        setIsRecentSectionOpen={setIsRecentSectionOpen}
        onResourceSelect={onResourceSelect}
      />

      {/* Navigation */}
      <ScrollArea className="flex-1 min-h-0">
        <nav className="p-2 pr-3 pb-4">
          <QuickAccessSection
            navFavorites={navFavorites}
            navLabelById={navLabelById}
            activeResource={activeResource}
            isNavFavoritesSectionOpen={isNavFavoritesSectionOpen}
            setIsNavFavoritesSectionOpen={setIsNavFavoritesSectionOpen}
            onResourceSelect={onResourceSelect}
            onToggleNavFavorite={toggleNavFavorite}
          />
          {navigationSections.map((section) => (
            <NavSectionCollapsible
              key={section.id}
              section={section}
              activeResource={activeResource}
              onResourceSelect={onResourceSelect}
              onResourceSelectNewTab={onResourceSelectNewTab}
              isNavFavorite={isNavFavorite}
              onToggleNavFavorite={toggleNavFavorite}
              defaultOpen={
                section.id === "cluster" ||
                section.id === "workloads" ||
                section.id === "networking"
              }
              soonLabel={tNav("soon")}
            />
          ))}
        </nav>
      </ScrollArea>

      {/* Settings Button */}
      <Separator />
      <div className="p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSettingsOpen(true)}
          className="w-full justify-between px-2 text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Cog className="size-4" />
            {tNav("settings")}
          </span>
          <Kbd className="text-[10px]">{modKeySymbol},</Kbd>
        </Button>
      </div>

      <ConfigureNamespacesDialog
        open={configureNsOpen}
        onOpenChange={setConfigureNsOpen}
        context={clusterContext}
        defaultNamespace={currentCluster?.namespace}
        existingNamespaces={namespaceSource === "configured" ? namespaces : undefined}
        onSave={saveAccessibleNamespaces}
        onClear={clearAccessibleNamespaces}
      />
    </aside>
  );
}
