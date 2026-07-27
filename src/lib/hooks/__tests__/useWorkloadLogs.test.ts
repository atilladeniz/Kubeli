import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useWorkloadLogs, supportsAggregatedLogs } from "../useWorkloadLogs";

const mockListPods = jest.fn();
const mockListDeployments = jest.fn();
const mockListStatefulsets = jest.fn();
const mockListDaemonsets = jest.fn();
const mockListReplicasets = jest.fn();
const mockListJobs = jest.fn();
const mockWatchPods = jest.fn();
const mockStopWatch = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listPods: (...args: unknown[]) => mockListPods(...args),
  listDeployments: (...args: unknown[]) => mockListDeployments(...args),
  listStatefulsets: (...args: unknown[]) => mockListStatefulsets(...args),
  listDaemonsets: (...args: unknown[]) => mockListDaemonsets(...args),
  listReplicasets: (...args: unknown[]) => mockListReplicasets(...args),
  listJobs: (...args: unknown[]) => mockListJobs(...args),
  streamPodLogs: jest.fn(),
  stopLogStream: jest.fn().mockResolvedValue(undefined),
  watchPods: (...args: unknown[]) => mockWatchPods(...args),
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

const mockListen = listen as jest.Mock;

describe("useWorkloadLogs unmount during watch setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListDeployments.mockResolvedValue([
      { name: "demo-web", namespace: "default", selector_query: "app=demo-web" },
    ]);
    mockListPods.mockResolvedValue([]);
    mockWatchPods.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(jest.fn());
  });

  // Regression: listen() resolved after the effect cleanup already ran, so
  // the listener was registered on an unmounted hook and never removed.
  it("removes the watch listener when unmounted while listen() is pending", async () => {
    let resolveListen!: (unlisten: () => void) => void;
    mockListen.mockImplementation(
      () => new Promise((resolve) => { resolveListen = resolve; })
    );

    const { unmount } = renderHook(() => useWorkloadLogs("demo-web", "default"));
    await act(async () => {});

    unmount();

    const unlisten = jest.fn();
    await act(async () => {
      resolveListen(unlisten);
    });

    expect(unlisten).toHaveBeenCalledTimes(1);
    // The watch must not start once cleanup has run
    expect(mockWatchPods).not.toHaveBeenCalled();
  });

  // Regression: cleanup's stopWatch ran while watchPods() was still pending,
  // so the watch started afterwards and leaked.
  it("stops the watch when unmounted while watchPods() is pending", async () => {
    let resolveWatch!: () => void;
    mockWatchPods.mockImplementation(
      () => new Promise<void>((resolve) => { resolveWatch = resolve; })
    );

    const { unmount } = renderHook(() => useWorkloadLogs("demo-web", "default"));
    await act(async () => {});
    expect(mockWatchPods).toHaveBeenCalledTimes(1);

    unmount();
    // Drop the cleanup's own (too early, no-op) stopWatch call
    mockStopWatch.mockClear();

    await act(async () => {
      resolveWatch();
    });

    expect(mockStopWatch).toHaveBeenCalledTimes(1);
    expect(mockStopWatch).toHaveBeenCalledWith(
      expect.stringContaining("workload-pods-deployment-default-demo-web")
    );
  });
});

describe("useWorkloadLogs seq stamping", () => {
  const podEntry = {
    name: "demo-web-7d4b8c-abcde",
    namespace: "default",
    phase: "Running",
    labels: { app: "demo-web" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListDeployments.mockResolvedValue([
      { name: "demo-web", namespace: "default", selector_query: "app=demo-web" },
    ]);
    mockListPods.mockResolvedValue([podEntry]);
    mockWatchPods.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(jest.fn());
  });

  // Regression: aggregated logs were pushed unstamped, so LogContent's
  // key={log.seq ?? item.index} always fell back to the index. Timestamp-ordered
  // merge-insertion shifts indices on nearly every flush, which recycles rows.
  it("stamps every ingested log entry with a unique, increasing seq", async () => {
    const logListeners: Array<(event: { payload: unknown }) => void> = [];
    mockListen.mockImplementation((eventName: string, handler: (e: { payload: unknown }) => void) => {
      if (eventName.startsWith("log-stream-")) logListeners.push(handler);
      return Promise.resolve(jest.fn());
    });

    const { result } = renderHook(() => useWorkloadLogs("demo-web", "default"));
    await act(async () => {});

    await act(async () => {
      await result.current.startStream();
    });

    expect(logListeners.length).toBeGreaterThan(0);
    const emit = logListeners[0];

    const line = (message: string, timestamp: string) => ({
      message,
      timestamp,
      container: "main",
      pod: podEntry.name,
      namespace: "default",
    });

    await act(async () => {
      emit({ payload: { type: "Line", data: line("first", "2024-01-01T10:00:02Z") } });
      emit({
        payload: {
          type: "Lines",
          data: [
            // Out of order on purpose: merge-insertion puts this before "first"
            line("second", "2024-01-01T10:00:01Z"),
            line("third", "2024-01-01T10:00:03Z"),
          ],
        },
      });
      // Flush is debounced at 150ms
      await new Promise((resolve) => setTimeout(resolve, 200));
    });

    const seqs = result.current.logs.map((l) => l.seq);
    expect(seqs).toHaveLength(3);
    expect(seqs.every((s) => typeof s === "number")).toBe(true);
    expect(new Set(seqs).size).toBe(3);

    // seq reflects ingest order, not the timestamp-sorted display order
    const bySeq = [...result.current.logs].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    expect(bySeq.map((l) => l.message)).toEqual(["first", "second", "third"]);
    expect(result.current.logs.map((l) => l.message)).toEqual(["second", "first", "third"]);
  });
});

describe("useWorkloadLogs pod resolution per workload kind", () => {
  const listerFor = {
    deployment: mockListDeployments,
    statefulset: mockListStatefulsets,
    daemonset: mockListDaemonsets,
    replicaset: mockListReplicasets,
    job: mockListJobs,
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListPods.mockResolvedValue([]);
    mockWatchPods.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(jest.fn());
    for (const lister of Object.values(listerFor)) {
      lister.mockResolvedValue([]);
    }
  });

  it.each([
    ["deployment", "demo-web", "app=demo-web"],
    ["statefulset", "demo-db", "app=demo-db"],
    ["daemonset", "demo-log-collector", "app=demo-log-collector"],
    ["replicaset", "demo-web-7d4b8c", "pod-template-hash=7d4b8c"],
    ["job", "demo-migration", "batch.kubernetes.io/controller-uid=abc-123"],
  ] as const)(
    "resolves %s pods through its own lister and selector",
    async (kind, name, selectorQuery) => {
      listerFor[kind].mockResolvedValue([
        { name, namespace: "default", selector_query: selectorQuery },
      ]);

      renderHook(() => useWorkloadLogs(name, "default", kind));
      await act(async () => {});

      expect(listerFor[kind]).toHaveBeenCalledWith({ namespace: "default" });
      // Every other lister must stay untouched
      for (const [otherKind, lister] of Object.entries(listerFor)) {
        if (otherKind !== kind) expect(lister).not.toHaveBeenCalled();
      }

      expect(mockListPods).toHaveBeenCalledWith({
        namespace: "default",
        label_selector: selectorQuery,
      });
      expect(mockWatchPods).toHaveBeenCalledWith(
        expect.stringContaining(`workload-pods-${kind}-default-${name}`),
        "default",
        selectorQuery
      );
    }
  );

  it("reports a kind-specific error when the workload is missing", async () => {
    mockListStatefulsets.mockResolvedValue([]);

    const { result } = renderHook(() => useWorkloadLogs("demo-db", "default", "statefulset"));
    await act(async () => {});

    expect(result.current.error?.message).toContain("StatefulSet demo-db not found");
    expect(mockListPods).not.toHaveBeenCalled();
  });

  it("skips the pod query when the selector is empty", async () => {
    mockListJobs.mockResolvedValue([
      { name: "demo-migration", namespace: "default", selector_query: "" },
    ]);

    const { result } = renderHook(() =>
      useWorkloadLogs("demo-migration", "default", "job")
    );
    await act(async () => {});

    expect(mockListPods).not.toHaveBeenCalled();
    expect(result.current.pods).toEqual([]);
  });

  it("defaults to deployment when no kind is given", async () => {
    mockListDeployments.mockResolvedValue([
      { name: "demo-web", namespace: "default", selector_query: "app=demo-web" },
    ]);

    renderHook(() => useWorkloadLogs("demo-web", "default"));
    await act(async () => {});

    expect(mockListDeployments).toHaveBeenCalled();
  });
});

describe("supportsAggregatedLogs", () => {
  it.each(["deployment", "statefulset", "daemonset", "replicaset", "job"])(
    "accepts %s",
    (kind) => {
      expect(supportsAggregatedLogs(kind)).toBe(true);
    }
  );

  // CronJobs own Jobs, not pods, so they need a second resolution hop.
  it.each(["cronjob", "pod", "service", "configmap"])("rejects %s", (kind) => {
    expect(supportsAggregatedLogs(kind)).toBe(false);
  });
});
