import { create } from "zustand";

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
    set((state) => ({
      cache: { ...state.cache, [key]: data },
    }));
  },

  clearCache: () => {
    set({ cache: {} });
  },
}));
