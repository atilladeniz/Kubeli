import { create } from "zustand";
import type { ResourceType } from "@/components/layout/Sidebar";

export interface TabMetadata {
  namespace?: string;
  podName?: string;
}

export interface Tab {
  id: string;
  type: ResourceType;
  title: string;
  metadata?: TabMetadata;
}

interface TabsState {
  tabs: Tab[];
  activeTabId: string;

  // Actions
  openTab: (type: ResourceType, title: string, opts?: { newTab?: boolean; metadata?: TabMetadata }) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  setActiveTab: (id: string) => void;
  navigateCurrentTab: (type: ResourceType, title: string) => void;
  reorderTabs: (activeId: string, overId: string) => void;
  restoreTabs: (clusterContext: string) => void;
  resetTabs: () => void;
}

const MAX_TABS = 10;

const DEFAULT_TAB: Tab = {
  id: "default",
  type: "cluster-overview",
  title: "Cluster - Overview",
};

function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function persistTabs(tabs: Tab[], activeTabId: string) {
  try {
    const clusterContext = getClusterContext();
    if (clusterContext) {
      localStorage.setItem(
        `kubeli:tabs:${clusterContext}`,
        JSON.stringify({ tabs, activeTabId })
      );
    }
  } catch {
    // localStorage may not be available
  }
}

function getClusterContext(): string | null {
  // Read from cluster store's state directly
  try {
    // Access the zustand store state directly
    const storeState = JSON.parse(
      localStorage.getItem("kubeli:last-cluster-context") || "null"
    );
    return storeState;
  } catch {
    return null;
  }
}

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [DEFAULT_TAB],
  activeTabId: DEFAULT_TAB.id,

  openTab: (type, title, opts) => {
    const { tabs } = get();

    // If not forcing new tab, navigate current tab
    if (!opts?.newTab) {
      get().navigateCurrentTab(type, title);
      return;
    }

    // Reject if at max
    if (tabs.length >= MAX_TABS) {
      return;
    }

    const newTab: Tab = { id: generateId(), type, title, ...(opts?.metadata && { metadata: opts.metadata }) };
    const newTabs = [...tabs, newTab];

    set({ tabs: newTabs, activeTabId: newTab.id });
    persistTabs(newTabs, newTab.id);
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) return; // Can't close last tab

    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    let newActiveId = activeTabId;

    if (activeTabId === id) {
      // Switch to adjacent tab
      const newIdx = Math.min(idx, newTabs.length - 1);
      newActiveId = newTabs[newIdx].id;
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
    persistTabs(newTabs, newActiveId);
  },

  closeOtherTabs: (id) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab) return;
    const newTabs = [tab];
    set({ tabs: newTabs, activeTabId: id });
    persistTabs(newTabs, id);
  },

  closeTabsToRight: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.slice(0, idx + 1);
    const newActiveId = newTabs.find((t) => t.id === activeTabId)
      ? activeTabId
      : id;
    set({ tabs: newTabs, activeTabId: newActiveId });
    persistTabs(newTabs, newActiveId);
  },

  setActiveTab: (id) => {
    const { tabs } = get();
    if (tabs.find((t) => t.id === id)) {
      set({ activeTabId: id });
      persistTabs(tabs, id);
    }
  },

  navigateCurrentTab: (type, title) => {
    const { tabs, activeTabId } = get();
    const newTabs = tabs.map((t) =>
      t.id === activeTabId ? { ...t, type, title } : t
    );
    set({ tabs: newTabs });
    persistTabs(newTabs, activeTabId);
  },

  reorderTabs: (activeId, overId) => {
    const { tabs, activeTabId } = get();
    const oldIndex = tabs.findIndex((t) => t.id === activeId);
    const newIndex = tabs.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
    const newTabs = [...tabs];
    const [moved] = newTabs.splice(oldIndex, 1);
    newTabs.splice(newIndex, 0, moved);
    set({ tabs: newTabs });
    persistTabs(newTabs, activeTabId);
  },

  restoreTabs: (clusterContext: string) => {
    try {
      // Save context for persistence
      localStorage.setItem(
        "kubeli:last-cluster-context",
        JSON.stringify(clusterContext)
      );

      const stored = localStorage.getItem(`kubeli:tabs:${clusterContext}`);
      if (stored) {
        const { tabs, activeTabId } = JSON.parse(stored);
        if (Array.isArray(tabs) && tabs.length > 0) {
          set({ tabs, activeTabId });
          return;
        }
      }
    } catch {
      // Fall through to default
    }
    set({ tabs: [DEFAULT_TAB], activeTabId: DEFAULT_TAB.id });
  },

  resetTabs: () => {
    set({ tabs: [DEFAULT_TAB], activeTabId: DEFAULT_TAB.id });
    try {
      const ctx = getClusterContext();
      if (ctx) localStorage.removeItem(`kubeli:tabs:${ctx}`);
    } catch {
      // ignore
    }
  },
}));
