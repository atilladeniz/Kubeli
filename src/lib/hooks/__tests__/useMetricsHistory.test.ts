import type { PodMetrics } from "@/lib/types";

// Must mock before importing the module under test
jest.mock("@/lib/tauri/commands", () => ({
  getPodMetrics: jest.fn(),
}));

jest.mock("@/lib/stores/cluster-store", () => ({
  useClusterStore: jest.fn(() => ({ isConnected: true })),
}));

import {
  getHistorySnapshot,
  seedHistoryFromBulkMetrics,
  clearMetricsHistory,
} from "../useMetricsHistory";

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
    clearMetricsHistory();
    jest.useRealTimers();
  });

  describe("getHistorySnapshot", () => {
    it("returns empty array for unknown key", () => {
      expect(getHistorySnapshot("unknown/pod")).toEqual([]);
    });
  });

  describe("seedHistoryFromBulkMetrics", () => {
    it("populates history for multiple pods with 2 initial points each", () => {
      const metrics = [
        makePodMetrics("web", 100_000_000, 200_000_000),
        makePodMetrics("api", 50_000_000, 100_000_000),
        makePodMetrics("db", 200_000_000, 400_000_000),
      ];

      seedHistoryFromBulkMetrics(metrics);

      // First seed creates 2 points (synthetic historical + current) for instant sparklines
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
      expect(getHistorySnapshot("kubeli-demo/api")).toHaveLength(2);
      expect(getHistorySnapshot("kubeli-demo/db")).toHaveLength(2);
    });

    it("synthetic initial point has earlier timestamp", () => {
      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];
      seedHistoryFromBulkMetrics(metrics);

      const history = getHistorySnapshot("kubeli-demo/web");
      expect(history[0].timestamp).toBeLessThan(history[1].timestamp);
    });

    it("deduplicates calls within 5 seconds", () => {
      jest.useFakeTimers();

      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];

      seedHistoryFromBulkMetrics(metrics);
      seedHistoryFromBulkMetrics(metrics);

      // First call: 2 points (synthetic + real), second call: deduped
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2);
    });

    it("allows new entry after 5 second gap", () => {
      jest.useFakeTimers();

      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];

      seedHistoryFromBulkMetrics(metrics);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(2); // synthetic + real

      // Advance 6 seconds
      jest.advanceTimersByTime(6_000);
      seedHistoryFromBulkMetrics(metrics);
      expect(getHistorySnapshot("kubeli-demo/web")).toHaveLength(3); // +1 new point
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

  describe("snapshot values", () => {
    it("stores correct cpu and memory values for the real point", () => {
      const metrics = [makePodMetrics("web", 125_000_000, 268_435_456)];
      seedHistoryFromBulkMetrics(metrics);

      const snapshot = getHistorySnapshot("kubeli-demo/web");
      // Index 0 is synthetic (jittered), index 1 is the real value
      expect(snapshot[1].cpuNanoCores).toBe(125_000_000);
      expect(snapshot[1].memoryBytes).toBe(268_435_456);
      expect(snapshot[1].timestamp).toBeGreaterThan(0);
    });

    it("synthetic point has jittered values close to real values", () => {
      const metrics = [makePodMetrics("web", 100_000_000, 200_000_000)];
      seedHistoryFromBulkMetrics(metrics);

      const snapshot = getHistorySnapshot("kubeli-demo/web");
      const synthetic = snapshot[0];
      // Jitter is ±5%, so values should be within 10% of the original
      expect(synthetic.cpuNanoCores).toBeGreaterThan(90_000_000);
      expect(synthetic.cpuNanoCores).toBeLessThan(110_000_000);
      expect(synthetic.memoryBytes).toBeGreaterThan(180_000_000);
      expect(synthetic.memoryBytes).toBeLessThan(220_000_000);
    });
  });
});
