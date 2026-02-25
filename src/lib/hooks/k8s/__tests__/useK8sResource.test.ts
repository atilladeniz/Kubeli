import { renderHook, act } from "@testing-library/react";
import { useK8sResource } from "../useK8sResource";
import { useClusterStore } from "../../../stores/cluster-store";
import type { ResourceHookConfig } from "../types";

// Mock Tauri commands
const mockStopWatch = jest.fn().mockResolvedValue(undefined);
jest.mock("../../../tauri/commands", () => ({
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

interface TestResource {
  uid: string;
  name: string;
  namespace: string;
}

describe("useK8sResource", () => {
  const mockListFn = jest.fn();
  const mockWatchFn = jest.fn().mockResolvedValue(undefined);

  const watchConfig: ResourceHookConfig<TestResource> = {
    displayName: "TestPods",
    listFn: mockListFn,
    supportsWatch: true,
    watchFn: mockWatchFn,
    watchEventPrefix: "pods",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockListFn.mockResolvedValue([]);

    useClusterStore.setState({
      isConnected: true,
      selectedNamespaces: ["default"],
      currentNamespace: "default",
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Helper: render the hook and wait for initial fetch + auto-watch to start.
   */
  async function renderAndStartWatch() {
    const hook = renderHook(() =>
      useK8sResource(watchConfig, { autoWatch: true })
    );

    // Flush initial fetch
    await act(async () => {
      await flushPromises();
    });

    // Auto-watch starts after 500ms delay
    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushPromises();
    });

    return hook;
  }

  describe("watch restart on namespace change", () => {
    it("should stop the old watch and start a new one when namespace changes", async () => {
      const { result } = await renderAndStartWatch();

      // Watch should have started for "default"
      expect(mockWatchFn).toHaveBeenCalledTimes(1);
      expect(mockWatchFn).toHaveBeenCalledWith(
        expect.stringContaining("testpods-"),
        "default"
      );
      expect(result.current.isWatching).toBe(true);

      // Change namespace to "kube-system"
      await act(async () => {
        useClusterStore.setState({ selectedNamespaces: ["kube-system"], currentNamespace: "kube-system" });
        await flushPromises();
      });

      // Watch restart is debounced by 300ms
      await act(async () => {
        jest.advanceTimersByTime(350);
        await flushPromises();
      });

      // The restart effect should have stopped the old watch
      expect(mockStopWatch).toHaveBeenCalled();

      // Auto-watch should restart with the new namespace after delay
      await act(async () => {
        jest.advanceTimersByTime(600);
        await flushPromises();
      });

      expect(mockWatchFn).toHaveBeenCalledTimes(2);
      expect(mockWatchFn).toHaveBeenLastCalledWith(
        expect.stringContaining("testpods-"),
        "kube-system"
      );
      expect(result.current.isWatching).toBe(true);
    });

    it("should not restart the watch if namespace stays the same", async () => {
      const { result } = await renderAndStartWatch();

      expect(result.current.isWatching).toBe(true);
      expect(mockWatchFn).toHaveBeenCalledTimes(1);

      // Set the same namespace again (no actual change)
      await act(async () => {
        useClusterStore.setState({ selectedNamespaces: ["default"], currentNamespace: "default" });
        await flushPromises();
      });

      // Watch should NOT have been restarted
      expect(mockStopWatch).not.toHaveBeenCalled();
      expect(result.current.isWatching).toBe(true);
      expect(mockWatchFn).toHaveBeenCalledTimes(1);
    });

    it("should pass the correct namespace to listFn after watch restart", async () => {
      const defaultPods = [{ uid: "1", name: "pod-a", namespace: "default" }];
      const kubePods = [{ uid: "2", name: "pod-b", namespace: "kube-system" }];

      mockListFn.mockResolvedValueOnce(defaultPods);
      await renderAndStartWatch();

      // Initial fetch used "default"
      expect(mockListFn).toHaveBeenCalledWith({ namespace: "default" });

      // Change namespace — listFn should be called with new namespace
      mockListFn.mockResolvedValueOnce(kubePods);

      await act(async () => {
        useClusterStore.setState({ selectedNamespaces: ["kube-system"], currentNamespace: "kube-system" });
        await flushPromises();
      });

      expect(mockListFn).toHaveBeenLastCalledWith({ namespace: "kube-system" });
    });

    it("should switch from namespace-filtered watch to all-namespaces", async () => {
      const { result } = await renderAndStartWatch();

      expect(mockWatchFn).toHaveBeenCalledWith(
        expect.any(String),
        "default"
      );

      // Switch to "All Namespaces" (empty string in store)
      await act(async () => {
        useClusterStore.setState({ selectedNamespaces: [], currentNamespace: "" });
        await flushPromises();
      });

      // Watch restart is debounced by 300ms
      await act(async () => {
        jest.advanceTimersByTime(350);
        await flushPromises();
      });

      // Old watch stopped
      expect(mockStopWatch).toHaveBeenCalled();

      // New watch starts without namespace filter
      await act(async () => {
        jest.advanceTimersByTime(600);
        await flushPromises();
      });

      expect(mockWatchFn).toHaveBeenCalledTimes(2);
      expect(mockWatchFn).toHaveBeenLastCalledWith(
        expect.any(String),
        undefined
      );
      expect(result.current.isWatching).toBe(true);
    });
  });

  describe("initial namespace filtering", () => {
    it("should pass namespace in listOptions for namespaced resources", async () => {
      renderHook(() => useK8sResource(watchConfig));

      await act(async () => {
        await flushPromises();
      });

      expect(mockListFn).toHaveBeenCalledWith({ namespace: "default" });
    });

    it("should pass empty options when no namespace is selected", async () => {
      useClusterStore.setState({ selectedNamespaces: [], currentNamespace: "" });

      renderHook(() => useK8sResource(watchConfig));

      await act(async () => {
        await flushPromises();
      });

      expect(mockListFn).toHaveBeenCalledWith({});
    });
  });
});

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
    jest.advanceTimersByTime(0);
  });
}
