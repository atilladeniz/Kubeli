import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useDeployments } from "../workloads";
import { useClusterStore } from "@/lib/stores/cluster-store";

const mockListDeployments = jest.fn();
const mockWatchDeployments = jest.fn();
const mockStopWatch = jest.fn();

jest.mock("../../../../tauri/commands", () => ({
  listPods: jest.fn().mockResolvedValue([]),
  listDeployments: (...args: unknown[]) => mockListDeployments(...args),
  listReplicasets: jest.fn().mockResolvedValue([]),
  listDaemonsets: jest.fn().mockResolvedValue([]),
  listStatefulsets: jest.fn().mockResolvedValue([]),
  listJobs: jest.fn().mockResolvedValue([]),
  listCronjobs: jest.fn().mockResolvedValue([]),
  watchPods: jest.fn().mockResolvedValue(undefined),
  watchDeployments: (...args: unknown[]) => mockWatchDeployments(...args),
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

describe("useDeployments watch wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockListDeployments.mockResolvedValue([]);
    mockWatchDeployments.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    useClusterStore.setState({ isConnected: true, selectedNamespaces: ["default"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderWithAutoWatch() {
    const hook = renderHook(() => useDeployments({ autoWatch: true }));
    await act(async () => {
      await flushPromises();
    });
    // Auto-watch starts after a 500ms delay
    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushPromises();
    });
    return hook;
  }

  it("starts a deployments watch for the selected namespace", async () => {
    const { result } = await renderWithAutoWatch();

    expect(mockWatchDeployments).toHaveBeenCalledTimes(1);
    expect(mockWatchDeployments).toHaveBeenCalledWith(
      expect.stringContaining("deployments-"),
      "default"
    );
    expect(result.current.isWatching).toBe(true);
  });

  it("listens on the deployments-watch event channel emitted by the backend", async () => {
    await renderWithAutoWatch();

    const watchId = mockWatchDeployments.mock.calls[0][0] as string;
    expect(listen).toHaveBeenCalledWith(
      `deployments-watch-${watchId}`,
      expect.any(Function)
    );
  });
});

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
    jest.advanceTimersByTime(0);
  });
}
