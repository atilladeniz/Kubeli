"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import type { ResourceType } from "@/components/layout/Sidebar";
import {
  NAVIGATION_SHORTCUTS,
  useKeyboardShortcuts,
} from "@/lib/hooks/useKeyboardShortcuts";
import type { Tab, TabMetadata } from "@/lib/stores/tabs-store";

interface UseDashboardShortcutsOptions {
  enabled: boolean;
  activeTabId: string;
  isAICliAvailable: boolean | null;
  resourceTabs: Tab[];
  tabLimitToast: string;
  closeTab: (id: string) => void;
  getTabTitle: (type: ResourceType) => string;
  navigateToFavorite: (index: number) => void;
  openCreateResource: () => void;
  openShortcutsHelp: () => void;
  openTab: (
    type: ResourceType,
    title: string,
    opts?: { newTab?: boolean; metadata?: TabMetadata }
  ) => void;
  setActiveResource: (type: ResourceType) => void;
  setActiveTab: (id: string) => void;
  toggleAIAssistant: () => void;
  triggerRefresh: () => void;
  triggerSearchFocus: () => void;
}

export function useDashboardShortcuts({
  enabled,
  activeTabId,
  isAICliAvailable,
  resourceTabs,
  tabLimitToast,
  closeTab,
  getTabTitle,
  navigateToFavorite,
  openCreateResource,
  openShortcutsHelp,
  openTab,
  setActiveResource,
  setActiveTab,
  toggleAIAssistant,
  triggerRefresh,
  triggerSearchFocus,
}: UseDashboardShortcutsOptions) {
  const shortcuts = useMemo(
    () => [
      {
        key: NAVIGATION_SHORTCUTS.GOTO_OVERVIEW,
        handler: () => setActiveResource("cluster-overview"),
        description: "Go to Overview",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_DIAGRAM,
        handler: () => setActiveResource("resource-diagram"),
        description: "Go to Diagram",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_PODS,
        handler: () => setActiveResource("pods"),
        description: "Go to Pods",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_DEPLOYMENTS,
        handler: () => setActiveResource("deployments"),
        description: "Go to Deployments",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_SERVICES,
        handler: () => setActiveResource("services"),
        description: "Go to Services",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_NODES,
        handler: () => setActiveResource("nodes"),
        description: "Go to Nodes",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_CONFIGMAPS,
        handler: () => setActiveResource("configmaps"),
        description: "Go to ConfigMaps",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_SECRETS,
        handler: () => setActiveResource("secrets"),
        description: "Go to Secrets",
      },
      {
        key: NAVIGATION_SHORTCUTS.GOTO_NAMESPACES,
        handler: () => setActiveResource("namespaces"),
        description: "Go to Namespaces",
      },
      {
        key: NAVIGATION_SHORTCUTS.FOCUS_SEARCH,
        handler: () => triggerSearchFocus(),
        description: "Focus search",
      },
      {
        key: NAVIGATION_SHORTCUTS.REFRESH,
        handler: () => triggerRefresh(),
        description: "Refresh view",
      },
      {
        key: NAVIGATION_SHORTCUTS.HELP,
        handler: () => openShortcutsHelp(),
        description: "Show shortcuts help",
      },
      {
        key: NAVIGATION_SHORTCUTS.TOGGLE_AI,
        handler: () => {
          if (isAICliAvailable !== false) toggleAIAssistant();
        },
        description: "Toggle AI Assistant",
      },
      // Favorite shortcuts (Cmd+1 through Cmd+9)
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_1,
        meta: true,
        handler: () => navigateToFavorite(0),
        description: "Go to Favorite 1",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_2,
        meta: true,
        handler: () => navigateToFavorite(1),
        description: "Go to Favorite 2",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_3,
        meta: true,
        handler: () => navigateToFavorite(2),
        description: "Go to Favorite 3",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_4,
        meta: true,
        handler: () => navigateToFavorite(3),
        description: "Go to Favorite 4",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_5,
        meta: true,
        handler: () => navigateToFavorite(4),
        description: "Go to Favorite 5",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_6,
        meta: true,
        handler: () => navigateToFavorite(5),
        description: "Go to Favorite 6",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_7,
        meta: true,
        handler: () => navigateToFavorite(6),
        description: "Go to Favorite 7",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_8,
        meta: true,
        handler: () => navigateToFavorite(7),
        description: "Go to Favorite 8",
      },
      {
        key: NAVIGATION_SHORTCUTS.FAVORITE_9,
        meta: true,
        handler: () => navigateToFavorite(8),
        description: "Go to Favorite 9",
      },
      // Create resource
      {
        key: NAVIGATION_SHORTCUTS.CREATE_RESOURCE,
        meta: true,
        handler: () => openCreateResource(),
        description: "Create Resource",
        global: true,
      },
      // Tab shortcuts
      {
        key: "t",
        meta: true,
        handler: () => {
          if (resourceTabs.length < 10) {
            openTab("cluster-overview", getTabTitle("cluster-overview"), {
              newTab: true,
            });
          } else {
            toast.warning(tabLimitToast);
          }
        },
        description: "New tab",
        global: true,
      },
      {
        key: "w",
        meta: true,
        handler: () => {
          if (resourceTabs.length > 1) closeTab(activeTabId);
        },
        description: "Close current tab",
        global: true,
      },
      {
        key: "Tab",
        meta: true,
        handler: () => {
          const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
          const nextIdx = (idx + 1) % resourceTabs.length;
          setActiveTab(resourceTabs[nextIdx].id);
        },
        description: "Next tab",
        global: true,
      },
      {
        key: "Tab",
        meta: true,
        shift: true,
        handler: () => {
          const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
          const prevIdx = (idx - 1 + resourceTabs.length) % resourceTabs.length;
          setActiveTab(resourceTabs[prevIdx].id);
        },
        description: "Previous tab",
        global: true,
      },
    ],
    [
      activeTabId,
      closeTab,
      getTabTitle,
      isAICliAvailable,
      navigateToFavorite,
      openCreateResource,
      openShortcutsHelp,
      openTab,
      resourceTabs,
      setActiveResource,
      setActiveTab,
      tabLimitToast,
      toggleAIAssistant,
      triggerRefresh,
      triggerSearchFocus,
    ]
  );

  useKeyboardShortcuts(shortcuts, { enabled });
}
