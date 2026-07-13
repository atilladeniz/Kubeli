import { create } from "zustand";

/** Max cached resource lists - oldest-written entries are evicted beyond this. */
export const MAX_CACHE_ENTRIES = 50;

interface ResourceCacheState {
  cache: Record<string, unknown[]>;
  getCache: <T>(key: string) => T[];
  setCache: <T>(key: string, data: T[]) => void;
  clearCache: () => void;
}

export const useResourceCacheStore = create<ResourceCacheState>((set, get) => ({
  cache: {},

  getCache: <T>(key: string): T[] => {
    return (get().cache[key] as T[] | undefined) ?? [];
  },

  setCache: <T>(key: string, data: T[]) => {
    set((state) => {
      // LRU via key insertion order: delete-then-set moves the key to the
      // end, so the first keys are always the least recently written.
      const next = { ...state.cache };
      delete next[key];
      next[key] = data;
      const keys = Object.keys(next);
      for (let i = 0; i < keys.length - MAX_CACHE_ENTRIES; i++) {
        delete next[keys[i]];
      }
      return { cache: next };
    });
  },

  clearCache: () => {
    set({ cache: {} });
  },
}));
