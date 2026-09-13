"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import type { ResourceType } from "@/components/layout/sidebar/Sidebar";
import { useKeyboardShortcuts } from "@/lib/hooks/useKeyboardShortcuts";
import { DASHBOARD_SHORTCUTS } from "../shortcuts";
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
  const shortcuts = useMemo(() => {
    const handlers: Record<string, () => void> = {
      "goto:overview": () => setActiveResource("cluster-overview"),
      "goto:diagram": () => setActiveResource("resource-diagram"),
      "goto:pods": () => setActiveResource("pods"),
      "goto:deployments": () => setActiveResource("deployments"),
      "goto:services": () => setActiveResource("services"),
      "goto:nodes": () => setActiveResource("nodes"),
      "goto:configmaps": () => setActiveResource("configmaps"),
      "goto:secrets": () => setActiveResource("secrets"),
      "goto:namespaces": () => setActiveResource("namespaces"),
      search: () => triggerSearchFocus(),
      refresh: () => triggerRefresh(),
      help: () => openShortcutsHelp(),
      "help:mod": () => openShortcutsHelp(),
      ai: () => {
        if (isAICliAvailable !== false) toggleAIAssistant();
      },
      create: () => openCreateResource(),
      "tab:new": () => {
        if (resourceTabs.length < 10) {
          openTab("cluster-overview", getTabTitle("cluster-overview"), {
            newTab: true,
          });
        } else {
          toast.warning(tabLimitToast);
        }
      },
      "tab:close": () => {
        if (resourceTabs.length > 1) closeTab(activeTabId);
      },
      "tab:next": () => {
        const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = (idx + 1) % resourceTabs.length;
        setActiveTab(resourceTabs[nextIdx].id);
      },
      "tab:previous": () => {
        const idx = resourceTabs.findIndex((t) => t.id === activeTabId);
        const prevIdx = (idx - 1 + resourceTabs.length) % resourceTabs.length;
        setActiveTab(resourceTabs[prevIdx].id);
      },
    };
    for (let i = 0; i < 9; i++) {
      handlers[`favorite:${i + 1}`] = () => navigateToFavorite(i);
    }

    // Registry entries without a handler (Escape) are display-only
    return DASHBOARD_SHORTCUTS.flatMap((s) => {
      const handler = handlers[s.id];
      if (!handler) return [];
      return [
        {
          key: s.key,
          mod: s.mod,
          shift: s.shift,
          global: s.global,
          handler,
          description: s.id,
        },
      ];
    });
  }, [
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
  ]);

  useKeyboardShortcuts(shortcuts, { enabled });
}
