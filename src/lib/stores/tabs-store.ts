import { create } from "zustand";
import type { ResourceType } from "@/components/layout/sidebar/Sidebar";
import { useLogStore } from "./log-store";

export interface TabMetadata {
  namespace?: string;
  podName?: string;
  deploymentName?: string;
  autoStream?: boolean;
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
  searchQueries: Record<string, string>;
  activeFilters: Record<string, string | null>;

  // Actions
  openTab: (type: ResourceType, title: string, opts?: { newTab?: boolean; metadata?: TabMetadata }) => void;
  /** Opens a new tab or activates an existing one if a match is found. Returns the tab ID. */
  openOrActivateTab: (
    type: ResourceType,
    title: string,
    metadata: TabMetadata,
    match: (tab: Tab) => boolean,
  ) => string | null;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeTabsToRight: (id: string) => void;
  setActiveTab: (id: string) => void;
  navigateCurrentTab: (type: ResourceType, title: string) => void;
  reorderTabs: (activeId: string, overId: string) => void;
  restoreTabs: (clusterContext: string) => void;
  resetTabs: () => void;
  setTabSearch: (tabId: string, query: string) => void;
  setTabFilter: (tabId: string, filter: string | null) => void;
}

export const MAX_TABS = 10;

/** Tab types that manage log streams and need cleanup on close. */
function isLogTab(type: string): boolean {
  return type === "pod-logs" || type === "deployment-logs";
}

const DEFAULT_TAB: Tab = {
  id: "default",
  type: "cluster-overview",
  title: "Cluster - Overview",
};

function generateId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Strip ephemeral metadata fields (e.g. autoStream) before saving to localStorage. */
function stripEphemeralMetadata(tabs: Tab[]): Tab[] {
  return tabs.map((tab) => {
    if (!tab.metadata?.autoStream) return tab;
    const { autoStream: _, ...rest } = tab.metadata;
    return { ...tab, metadata: rest };
  });
}

// Read-through cache + debounced writes: rapid tab operations (open/close/
// switch) update the cache synchronously and hit localStorage at most once
// per PERSIST_DEBOUNCE_MS. Reads prefer the cache so pending writes are seen.
const PERSIST_DEBOUNCE_MS = 300;
const persistCache = new Map<string, string>();
const dirtyKeys = new Set<string>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  for (const key of dirtyKeys) {
    try {
      const value = persistCache.get(key);
      if (value !== undefined) localStorage.setItem(key, value);
    } catch {
      // localStorage may not be available
    }
  }
  dirtyKeys.clear();
}

// Don't lose tab changes made within the debounce window right before quit
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flushPersist);
}

function persistTabs(tabs: Tab[], activeTabId: string) {
  const clusterContext = getClusterContext();
  if (!clusterContext) return;
  const key = `kubeli:tabs:${clusterContext}`;
  persistCache.set(
    key,
    JSON.stringify({ tabs: stripEphemeralMetadata(tabs), activeTabId })
  );
  dirtyKeys.add(key);
  if (!persistTimer) {
    persistTimer = setTimeout(flushPersist, PERSIST_DEBOUNCE_MS);
  }
}

let cachedClusterContext: string | null | undefined;

function getClusterContext(): string | null {
  if (cachedClusterContext !== undefined) return cachedClusterContext;
  try {
    cachedClusterContext = JSON.parse(
      localStorage.getItem("kubeli:last-cluster-context") || "null"
    );
  } catch {
    cachedClusterContext = null;
  }
  return cachedClusterContext ?? null;
}

export const useTabsStore = create<TabsState>((set, get) => {
  return {
    tabs: [DEFAULT_TAB],
    activeTabId: DEFAULT_TAB.id,
    searchQueries: {},
    activeFilters: {},

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

    openOrActivateTab: (type, title, metadata, match) => {
      const { tabs } = get();
      const existing = tabs.find(match);
      if (existing) {
        set({ activeTabId: existing.id });
        persistTabs(tabs, existing.id);
        return existing.id;
      }
      if (tabs.length >= MAX_TABS) {
        return null;
      }
      const newTab: Tab = { id: generateId(), type, title, metadata };
      const newTabs = [...tabs, newTab];
      set({ tabs: newTabs, activeTabId: newTab.id });
      persistTabs(newTabs, newTab.id);
      return newTab.id;
    },

    closeTab: (id) => {
      const { tabs, activeTabId, searchQueries, activeFilters } = get();
      if (tabs.length <= 1) return; // Can't close last tab

      const closedTab = tabs.find((t) => t.id === id);
      const idx = tabs.findIndex((t) => t.id === id);
      const newTabs = tabs.filter((t) => t.id !== id);
      let newActiveId = activeTabId;

      if (activeTabId === id) {
        // Switch to adjacent tab
        const newIdx = Math.min(idx, newTabs.length - 1);
        newActiveId = newTabs[newIdx].id;
      }

      const { [id]: _sq, ...restQueries } = searchQueries;
      const { [id]: _af, ...restFilters } = activeFilters;
      set({ tabs: newTabs, activeTabId: newActiveId, searchQueries: restQueries, activeFilters: restFilters });
      persistTabs(newTabs, newActiveId);

      if (closedTab && isLogTab(closedTab.type)) {
        useLogStore.getState().cleanupLogTab(id);
      }
    },

    closeOtherTabs: (id) => {
      const { tabs, searchQueries, activeFilters } = get();
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return;

      const removedTabs = tabs.filter((t) => t.id !== id);
      const newTabs = [tab];
      const keptQueries = id in searchQueries ? { [id]: searchQueries[id] } : {};
      const keptFilters = id in activeFilters ? { [id]: activeFilters[id] } : {};
      set({ tabs: newTabs, activeTabId: id, searchQueries: keptQueries, activeFilters: keptFilters });
      persistTabs(newTabs, id);

      for (const t of removedTabs) {
        if (isLogTab(t.type)) {
          useLogStore.getState().cleanupLogTab(t.id);
        }
      }
    },

    closeTabsToRight: (id) => {
      const { tabs, activeTabId, searchQueries, activeFilters } = get();
      const idx = tabs.findIndex((t) => t.id === id);
      const newTabs = tabs.slice(0, idx + 1);
      const removedTabs = tabs.slice(idx + 1);
      const newActiveId = newTabs.find((t) => t.id === activeTabId)
        ? activeTabId
        : id;
      const keptIds = new Set(newTabs.map((t) => t.id));
      const newQueries: Record<string, string> = {};
      const newFilters: Record<string, string | null> = {};
      for (const tid of keptIds) {
        if (tid in searchQueries) newQueries[tid] = searchQueries[tid];
        if (tid in activeFilters) newFilters[tid] = activeFilters[tid];
      }
      set({ tabs: newTabs, activeTabId: newActiveId, searchQueries: newQueries, activeFilters: newFilters });
      persistTabs(newTabs, newActiveId);

      for (const t of removedTabs) {
        if (isLogTab(t.type)) {
          useLogStore.getState().cleanupLogTab(t.id);
        }
      }
    },

    setActiveTab: (id) => {
      const { tabs } = get();
      if (tabs.find((t) => t.id === id)) {
        set({ activeTabId: id });
        persistTabs(tabs, id);
      }
    },

    navigateCurrentTab: (type, title) => {
      const { tabs, activeTabId, searchQueries, activeFilters } = get();
      const newTabs = tabs.map((t) =>
        t.id === activeTabId ? { ...t, type, title } : t
      );
      const { [activeTabId]: _sq, ...restQueries } = searchQueries;
      const { [activeTabId]: _af, ...restFilters } = activeFilters;
      set({ tabs: newTabs, searchQueries: restQueries, activeFilters: restFilters });
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
        cachedClusterContext = clusterContext;
        localStorage.setItem(
          "kubeli:last-cluster-context",
          JSON.stringify(clusterContext)
        );

        const key = `kubeli:tabs:${clusterContext}`;
        const stored = persistCache.get(key) ?? localStorage.getItem(key);
        if (stored) {
          persistCache.set(key, stored);
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
      const { tabs } = get();
      set({ tabs: [DEFAULT_TAB], activeTabId: DEFAULT_TAB.id, searchQueries: {}, activeFilters: {} });
      try {
        const ctx = getClusterContext();
        if (ctx) {
          const key = `kubeli:tabs:${ctx}`;
          // Drop any pending debounced write so it can't resurrect the key
          persistCache.delete(key);
          dirtyKeys.delete(key);
          localStorage.removeItem(key);
        }
      } catch {
        // ignore
      }

      for (const t of tabs) {
        if (isLogTab(t.type)) {
          useLogStore.getState().cleanupLogTab(t.id);
        }
      }
    },

    setTabSearch: (tabId, query) => {
      const { searchQueries } = get();
      if (query) {
        set({ searchQueries: { ...searchQueries, [tabId]: query } });
      } else {
        const { [tabId]: _, ...rest } = searchQueries;
        set({ searchQueries: rest });
      }
    },

    setTabFilter: (tabId, filter) => {
      const { activeFilters } = get();
      if (filter !== null) {
        set({ activeFilters: { ...activeFilters, [tabId]: filter } });
      } else {
        const { [tabId]: _, ...rest } = activeFilters;
        set({ activeFilters: rest });
      }
    },
  };
});
