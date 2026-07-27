import { renderHook, act } from "@testing-library/react";
import { useClusterMetrics, useNodeMetrics } from "../useMetrics";
import { useUIStore, defaultSettings } from "../../stores/ui-store";
import { getClusterMetricsSummary, getNodeMetrics } from "../../tauri/commands";

jest.mock("../../tauri/commands", () => ({
  getClusterMetricsSummary: jest.fn(),
  getNodeMetrics: jest.fn(),
  getPodMetrics: jest.fn(),
  getPodMetricsDirect: jest.fn(),
  checkMetricsServer: jest.fn(),
}));

jest.mock("../../stores/cluster-store", () => ({
  useClusterStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isConnected: true, selectedNamespaces: [] }),
  selectCurrentNamespace: () => "default",
}));

const mockClusterSummary = getClusterMetricsSummary as jest.Mock;
const mockNodeMetrics = getNodeMetrics as jest.Mock;

const setMetricsInterval = (seconds: number) =>
  useUIStore.setState({
    settings: { ...defaultSettings, metricsRefreshInterval: seconds },
  });

describe("metrics polling interval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockClusterSummary.mockResolvedValue({ metrics_available: true });
    mockNodeMetrics.mockResolvedValue([]);
    setMetricsInterval(defaultSettings.metricsRefreshInterval);
  });

  afterEach(() => {
    jest.useRealTimers();
    useUIStore.setState({ settings: defaultSettings });
  });

  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  it("polls at the configured interval", async () => {
    setMetricsInterval(5);
    renderHook(() => useClusterMetrics({ autoRefresh: true }));

    // Initial fetch on mount
    await act(async () => {});
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);

    await advance(5000);
    expect(mockClusterSummary).toHaveBeenCalledTimes(2);

    await advance(5000);
    expect(mockClusterSummary).toHaveBeenCalledTimes(3);
  });

  it("honours a longer interval", async () => {
    setMetricsInterval(60);
    renderHook(() => useClusterMetrics({ autoRefresh: true }));
    await act(async () => {});
    mockClusterSummary.mockClear();

    await advance(30_000);
    expect(mockClusterSummary).not.toHaveBeenCalled();

    await advance(30_000);
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);
  });

  // 0 means the user turned polling off; only the manual button remains
  it("stops polling when the interval is set to disabled", async () => {
    setMetricsInterval(0);
    const { result } = renderHook(() => useClusterMetrics({ autoRefresh: true }));

    // The mount fetch still runs — an empty panel would be worse than one
    // stale reading the user can refresh.
    await act(async () => {});
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);
    mockClusterSummary.mockClear();

    await advance(300_000);
    expect(mockClusterSummary).not.toHaveBeenCalled();

    // Manual refresh still works
    await act(async () => {
      await result.current.refresh();
    });
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);
  });

  it("applies the setting to node metrics too", async () => {
    setMetricsInterval(5);
    renderHook(() => useNodeMetrics({ autoRefresh: true }));
    await act(async () => {});
    mockNodeMetrics.mockClear();

    await advance(5000);
    expect(mockNodeMetrics).toHaveBeenCalledTimes(1);
  });

  it("does not poll when autoRefresh is off, whatever the interval", async () => {
    setMetricsInterval(5);
    renderHook(() => useClusterMetrics({ autoRefresh: false }));
    await act(async () => {});
    mockClusterSummary.mockClear();

    await advance(60_000);
    expect(mockClusterSummary).not.toHaveBeenCalled();
  });

  // No caller overrides today, but the escape hatch must keep working
  it("lets an explicit refreshInterval win over the setting", async () => {
    setMetricsInterval(60);
    renderHook(() => useClusterMetrics({ autoRefresh: true, refreshInterval: 2000 }));
    await act(async () => {});
    mockClusterSummary.mockClear();

    await advance(2000);
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);
  });

  it("picks up a changed setting without a remount", async () => {
    setMetricsInterval(60);
    renderHook(() => useClusterMetrics({ autoRefresh: true }));
    await act(async () => {});
    mockClusterSummary.mockClear();

    await act(async () => {
      setMetricsInterval(5);
    });

    await advance(5000);
    expect(mockClusterSummary).toHaveBeenCalledTimes(1);
  });
});
