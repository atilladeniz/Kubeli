import type { PodMetrics } from "@/lib/types";

// Must mock before importing the module under test
jest.mock("@/lib/tauri/commands", () => ({
  getPodMetrics: jest.fn(),
}));

const mockClusterState = {
  isConnected: true,
  currentCluster: { context: "ctx-a" } as { context: string } | null,
};

jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: Object.assign(
    jest.fn((selector?: (s: typeof mockClusterState) => unknown) =>
      selector ? selector(mockClusterState) : mockClusterState
    ),
    { getState: () => mockClusterState }
  ),
}));

import { renderHook, act } from "@testing-library/react";
import { useUIStore, defaultSettings } from "@/lib/stores/ui-store";
import { getPodMetrics } from "@/lib/tauri/commands";
import {
  useMetricsHistory,
  getHistorySnapshot,
  seedHistoryFromBulkMetrics,
  clearMetricsHistory,
} from "../useMetricsHistory";

const mockGetPodMetrics = getPodMetrics as jest.Mock;

function makePodMetrics(name: string, cpu: number, mem: number): PodMetrics {
  return {
    name,
    namespace: "kubeli-demo",
    timestamp: new Date().toISOString(),
    containers: [],
    total_cpu: `${Math.round(cpu / 1_000_000)}m`,
    total_cpu_nano_cores: cpu,
    total_memory: `${Math.round(mem / (1024 ** 2))}Mi`,
    total_memory_bytes: mem,
  };
}

describe("useMetricsHistory module", () => {
  beforeEach(() => {
    mockClusterState.currentCluster = { context: "ctx-a" };
    clearMetricsHistory();
    jest.useRealTimers();
  });

  describe("getHistorySnapshot", () => {
    it("returns empty array for unknown key", () => {
      expect(getHistorySnapshot("unknown/pod")).toEqual([]);
    });
  });

  describe("seedHistoryFromBulkMetrics", () => {
    it("populates history with flat baseline on first seed", () => {
      const metrics = [
        makePodMetrics("web", 100_000_000, 200_000_000),
        makePodMetrics("api", 50_000_000, 100_000_000),
        makePodMetrics("db", 200_000_000, 400_000_000),
      ];

      seedHistoryFromBulkMetrics(metrics);

      // First seed creates 2 points (flat baseline + current) for instant sparkline
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
      expect(getHistorySnapshot("kubeli-demo/api")).toHaveLength(2);
      expect(getHistorySnapshot("kubeli-demo/db")).toHaveLength(2);
    });

    it("flat baseline has identical values to real point", () => {
      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];
      seedHistoryFromBulkMetrics(metrics);

      const history = getHistorySnapshot("kubeli-demo/web");
      expect(history[0].cpuNanoCores).toBe(history[1].cpuNanoCores);
      expect(history[0].memoryBytes).toBe(history[1].memoryBytes);
      expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
    });

    it("deduplicates calls within 3 seconds", () => {
      jest.useFakeTimers();

      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];

      seedHistoryFromBulkMetrics(metrics);
      seedHistoryFromBulkMetrics(metrics);

      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
    });

    it("allows new entry after 3 second gap", () => {
      jest.useFakeTimers();

      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];

      seedHistoryFromBulkMetrics(metrics);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);

      jest.advanceTimersByTime(4_000);
      seedHistoryFromBulkMetrics(metrics);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(3);
    });
  });

  describe("clearMetricsHistory", () => {
    it("empties all history", () => {
      const metrics = [
        makePodMetrics("web", 100_000_000, 200_000_000),
        makePodMetrics("api", 50_000_000, 100_000_000),
      ];
      seedHistoryFromBulkMetrics(metrics);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);

      clearMetricsHistory();

      expect(getHistorySnapshot("kubeli-demo/web")).toEqual([]);
      expect(getHistorySnapshot("kubeli-demo/api")).toEqual([]);
    });
  });

  describe("cluster context switch", () => {
    // Regression: history persisted across cluster switches, so sparklines
    // briefly showed the previous cluster's data.
    it("drops history from the previous cluster", () => {
      seedHistoryFromBulkMetrics([makePodMetrics("web", 100_000_000, 200_000_000)]);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);

      mockClusterState.currentCluster = { context: "ctx-b" };

      expect(getHistorySnapshot("kubeli-demo/web")).toEqual([]);
    });

    it("keeps history while the context stays the same", () => {
      seedHistoryFromBulkMetrics([makePodMetrics("web", 100_000_000, 200_000_000)]);

      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
    });
  });

  describe("history trimming", () => {
    it("trims at MAX_POINTS (30)", () => {
      jest.useFakeTimers();

      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];

      for (let i = 0; i < 35; i++) {
        seedHistoryFromBulkMetrics(metrics);
        jest.advanceTimersByTime(6_000);
      }

      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(30);
    });
  });

  // Regression for the metrics-interval setting: the pod-detail sparkline
  // polled on its own hardcoded 10s timer, so "Disabled" (0) never stopped it.
  describe("polling interval setting", () => {
    const setMetricsInterval = (seconds: number) =>
      useUIStore.setState({
        settings: { ...defaultSettings, metricsRefreshInterval: seconds },
      });

    const advance = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
      });
    };

    beforeEach(() => {
      jest.useFakeTimers();
      mockGetPodMetrics.mockClear();
      mockGetPodMetrics.mockResolvedValue([
        makePodMetrics("web", 100_000_000, 200_000_000),
      ]);
    });

    afterEach(() => {
      useUIStore.setState({ settings: defaultSettings });
    });

    it("polls at the configured cadence", async () => {
      setMetricsInterval(5);
      renderHook(() => useMetricsHistory("web", "kubeli-demo"));

      // Initial mount poll (setTimeout 0)
      await advance(0);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(1);

      await advance(5_000);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(2);

      await advance(5_000);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(3);
    });

    it("stops after the mount poll when the interval is disabled", async () => {
      setMetricsInterval(0);
      renderHook(() => useMetricsHistory("web", "kubeli-demo"));

      // One current reading beats an empty panel, so the mount poll stays
      await advance(0);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(1);

      await advance(300_000);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(1);
    });

    it("applies a changed setting without a remount", async () => {
      setMetricsInterval(60);
      renderHook(() => useMetricsHistory("web", "kubeli-demo"));

      await advance(0);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(1);

      await advance(30_000);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(1);

      await act(async () => {
        setMetricsInterval(5);
      });

      await advance(5_000);
      expect(mockGetPodMetrics).toHaveBeenCalledTimes(2);
    });
  });

  describe("snapshot values", () => {
    it("stores correct cpu and memory values", () => {
      const metrics = [makePodMetrics("web", 125_000_000, 268_435_456)];
      seedHistoryFromBulkMetrics(metrics);

      const snapshot = getHistorySnapshot("kubeli-demo/web");
      expect(snapshot[1].cpuNanoCores).toBe(125_000_000);
      expect(snapshot[1].memoryBytes).toBe(268_435_456);
      expect(snapshot[1].timestamp).toBeGreaterThan(0);
    });
  });
});
