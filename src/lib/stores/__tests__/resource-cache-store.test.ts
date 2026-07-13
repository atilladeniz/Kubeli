import { useResourceCacheStore, MAX_CACHE_ENTRIES } from "../resource-cache-store";

describe("resource-cache-store", () => {
  beforeEach(() => {
    useResourceCacheStore.getState().clearCache();
  });

  it("stores and returns cached data", () => {
    const { setCache, getCache } = useResourceCacheStore.getState();
    setCache("Pods:default", [{ name: "pod-1" }]);
    expect(getCache("Pods:default")).toEqual([{ name: "pod-1" }]);
    expect(getCache("Pods:missing")).toEqual([]);
  });

  // Regression: the cache grew unbounded across namespaces/clusters.
  it("evicts the oldest entries beyond MAX_CACHE_ENTRIES", () => {
    const { setCache, getCache } = useResourceCacheStore.getState();
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      setCache(`Pods:ns-${i}`, [i]);
    }
    setCache("Pods:ns-new", ["new"]);

    expect(Object.keys(useResourceCacheStore.getState().cache)).toHaveLength(
      MAX_CACHE_ENTRIES
    );
    expect(getCache("Pods:ns-0")).toEqual([]); // oldest evicted
    expect(getCache("Pods:ns-1")).toEqual([1]);
    expect(getCache("Pods:ns-new")).toEqual(["new"]);
  });

  it("re-writing a key refreshes its recency", () => {
    const { setCache, getCache } = useResourceCacheStore.getState();
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      setCache(`Pods:ns-${i}`, [i]);
    }
    setCache("Pods:ns-0", ["updated"]); // moves ns-0 to the newest slot
    setCache("Pods:ns-extra", ["extra"]);

    expect(getCache("Pods:ns-0")).toEqual(["updated"]); // survived
    expect(getCache("Pods:ns-1")).toEqual([]); // now the oldest, evicted
  });

  it("clearCache empties the cache", () => {
    const { setCache, clearCache } = useResourceCacheStore.getState();
    setCache("Pods:default", [1, 2]);
    clearCache();
    expect(useResourceCacheStore.getState().cache).toEqual({});
  });
});
