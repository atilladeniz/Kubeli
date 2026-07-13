import { useTabsStore } from "../tabs-store";

jest.mock("../log-store", () => ({
  useLogStore: {
    getState: () => ({
      cleanupLogTab: jest.fn(),
    }),
  },
}));

describe("tabs-store persistence", () => {
  let setItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    useTabsStore.setState({
      tabs: [{ id: "default", type: "cluster-overview", title: "Cluster - Overview" }],
      activeTabId: "default",
      searchQueries: {},
      activeFilters: {},
    });
    setItemSpy = jest.spyOn(Storage.prototype, "setItem");
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    setItemSpy.mockRestore();
    localStorage.clear();
  });

  // Regression: every tab operation wrote localStorage synchronously,
  // thrashing it during rapid open/close/switch sequences.
  it("debounces localStorage writes and persists only the final state", () => {
    useTabsStore.getState().restoreTabs("ctx-debounce");
    setItemSpy.mockClear();

    useTabsStore.getState().openTab("pods", "Pods", { newTab: true });
    useTabsStore.getState().openTab("services", "Services", { newTab: true });
    useTabsStore.getState().setActiveTab("default");

    // Nothing hits localStorage inside the debounce window
    expect(setItemSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);

    expect(setItemSpy).toHaveBeenCalledTimes(1);
    const [key, value] = setItemSpy.mock.calls[0];
    expect(key).toBe("kubeli:tabs:ctx-debounce");
    const parsed = JSON.parse(value as string);
    expect(parsed.tabs).toHaveLength(3);
    expect(parsed.activeTabId).toBe("default");
  });

  it("restoreTabs reads pending state from the cache before it is flushed", () => {
    useTabsStore.getState().restoreTabs("ctx-cache");
    useTabsStore.getState().openTab("pods", "Pods", { newTab: true });
    const pendingActiveId = useTabsStore.getState().activeTabId;

    // Not yet flushed to localStorage
    expect(localStorage.getItem("kubeli:tabs:ctx-cache")).toBeNull();

    // Simulate a remount restoring before the debounce flush fires
    useTabsStore.setState({
      tabs: [{ id: "default", type: "cluster-overview", title: "Cluster - Overview" }],
      activeTabId: "default",
    });
    useTabsStore.getState().restoreTabs("ctx-cache");

    expect(useTabsStore.getState().tabs).toHaveLength(2);
    expect(useTabsStore.getState().activeTabId).toBe(pendingActiveId);
  });

  it("resetTabs drops a pending write so it cannot resurrect the key", () => {
    useTabsStore.getState().restoreTabs("ctx-reset");
    useTabsStore.getState().openTab("pods", "Pods", { newTab: true });
    useTabsStore.getState().resetTabs();

    jest.runOnlyPendingTimers();

    expect(localStorage.getItem("kubeli:tabs:ctx-reset")).toBeNull();
  });
});
