import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import {
  useDeployments,
  useStatefulSets,
  useDaemonSets,
  useReplicaSets,
} from "../workloads";
import { useClusterStore } from "@/lib/stores/cluster-store";

const mockListDeployments = jest.fn();
const mockWatchDeployments = jest.fn();
const mockWatchStatefulsets = jest.fn();
const mockWatchDaemonsets = jest.fn();
const mockWatchReplicasets = jest.fn();
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
  watchStatefulsets: (...args: unknown[]) => mockWatchStatefulsets(...args),
  watchDaemonsets: (...args: unknown[]) => mockWatchDaemonsets(...args),
  watchReplicasets: (...args: unknown[]) => mockWatchReplicasets(...args),
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

/**
 * Each workload hook must call its own watch command and subscribe to the
 * matching `<prefix>-watch-<id>` event the Rust side emits. A prefix typo
 * fails silently at runtime, so it is pinned here.
 */
const cases = [
  { name: "Deployments", hook: useDeployments, watchMock: mockWatchDeployments, prefix: "deployments" },
  { name: "StatefulSets", hook: useStatefulSets, watchMock: mockWatchStatefulsets, prefix: "statefulsets" },
  { name: "DaemonSets", hook: useDaemonSets, watchMock: mockWatchDaemonsets, prefix: "daemonsets" },
  { name: "ReplicaSets", hook: useReplicaSets, watchMock: mockWatchReplicasets, prefix: "replicasets" },
] as const;

describe.each(cases)("use$name watch wiring", ({ hook, watchMock, prefix }) => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockListDeployments.mockResolvedValue([]);
    watchMock.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    useClusterStore.setState({ isConnected: true, selectedNamespaces: ["default"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderWithAutoWatch() {
    const rendered = renderHook(() => hook({ autoWatch: true }));
    await act(async () => {
      await flushPromises();
    });
    // Auto-watch starts after a 500ms delay
    await act(async () => {
      jest.advanceTimersByTime(600);
      await flushPromises();
    });
    return rendered;
  }

  it("starts a watch for the selected namespace", async () => {
    const { result } = await renderWithAutoWatch();

    expect(watchMock).toHaveBeenCalledTimes(1);
    expect(watchMock).toHaveBeenCalledWith(expect.stringContaining(`${prefix}-`), "default");
    expect(result.current.isWatching).toBe(true);
  });

  it(`listens on the ${prefix}-watch event channel emitted by the backend`, async () => {
    await renderWithAutoWatch();

    const watchId = watchMock.mock.calls[0][0] as string;
    expect(listen).toHaveBeenCalledWith(`${prefix}-watch-${watchId}`, expect.any(Function));
  });
});

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
    jest.advanceTimersByTime(0);
  });
}
