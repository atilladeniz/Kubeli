import { renderHook, act, waitFor } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useWorkloadLogs, supportsAggregatedLogs } from "../useWorkloadLogs";

const mockStreamPodLogs = jest.fn();
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
  streamPodLogs: (...args: unknown[]) => mockStreamPodLogs(...args),
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

// Regression: every Ended event was treated as routine pod rotation, so a real
// network drop silently killed that pod's stream — no lines, no notice.
describe("useWorkloadLogs stream drop vs pod rotation", () => {
  const podEntry = {
    uid: "uid-1",
    name: "demo-web-7d4b8c-abcde",
    namespace: "default",
    phase: "Running",
    labels: { app: "demo-web" },
  };

  /** Starts an aggregated stream for one running pod and returns its emitters */
  async function startStreamingOnePod() {
    const logListeners: Array<(event: { payload: unknown }) => void> = [];
    const logUnlistens: jest.Mock[] = [];
    let watchListener: ((event: { payload: unknown }) => void) | undefined;
    mockListen.mockImplementation(
      (eventName: string, handler: (e: { payload: unknown }) => void) => {
        const unlisten = jest.fn();
        if (eventName.startsWith("log-stream-")) {
          logListeners.push(handler);
          logUnlistens.push(unlisten);
        }
        if (eventName.startsWith("pods-watch-")) watchListener = handler;
        return Promise.resolve(unlisten);
      }
    );

    const { result } = renderHook(() => useWorkloadLogs("demo-web", "default"));
    await act(async () => {});
    await act(async () => {
      await result.current.startStream();
    });

    expect(mockStreamPodLogs).toHaveBeenCalledTimes(1);
    return { result, logListeners, logUnlistens, watchListener: watchListener! };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockListDeployments.mockResolvedValue([
      { name: "demo-web", namespace: "default", selector_query: "app=demo-web" },
    ]);
    mockListPods.mockResolvedValue([podEntry]);
    mockWatchPods.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    mockStreamPodLogs.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(jest.fn());
  });

  it("resubscribes when a stream drops while the pod is still on the roster", async () => {
    const { logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({
        payload: {
          type: "Line",
          data: {
            message: "hello",
            timestamp: new Date(Date.now() - 5000).toISOString(),
            container: "main",
            pod: podEntry.name,
            namespace: "default",
          },
        },
      });
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });

    // The resubscribe runs off an async chain, so poll instead of assuming ticks
    await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(2));
    const [, resumeOptions] = mockStreamPodLogs.mock.calls[1];
    expect(resumeOptions).toMatchObject({
      namespace: "default",
      pod_name: podEntry.name,
      follow: true,
    });
    // Resumes from the last line seen instead of refetching the tail
    expect(resumeOptions.since_seconds).toBeGreaterThan(0);
    expect(resumeOptions.tail_lines).toBeUndefined();
  });

  it("drops the dead stream's listener when resubscribing", async () => {
    const { logListeners, logUnlistens } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });

    await waitFor(() => expect(logUnlistens[0]).toHaveBeenCalledTimes(1));
    expect(logUnlistens[1]).not.toHaveBeenCalled();
  });

  // Regression: the backend always emits Ended and then Stopped for the same
  // stream. Stopped emptied the roster and cleared isStreaming, while the
  // replacement stream had no Started handler to set it again — so the view
  // reported "not streaming" while resubscribed lines kept arriving.
  it("keeps reporting isStreaming after a drop is recovered", async () => {
    const { result, logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Started" } });
    });
    expect(result.current.isStreaming).toBe(true);

    // Real backend order for a dropped stream
    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
      logListeners[0]({ payload: { type: "Stopped", data: {} } });
    });
    await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(2));

    // The replacement stream reports Started just like any other
    await act(async () => {
      logListeners[1]({ payload: { type: "Started" } });
    });

    expect(result.current.isStreaming).toBe(true);
  });

  // Regression: stream IDs were Date.now()-only, so a resubscribe landing in
  // the same millisecond reused the dead stream's ID — two live streams then
  // shared one event channel and one stop handle.
  it("gives the resubscribed stream an ID of its own", async () => {
    const { logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });
    await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(2));

    const [firstId] = mockStreamPodLogs.mock.calls[0];
    const [secondId] = mockStreamPodLogs.mock.calls[1];
    expect(secondId).not.toBe(firstId);
  });

  it("stays silent when the pod rotated out of the roster", async () => {
    const { logListeners, watchListener } = await startStreamingOnePod();

    // Rolling update: the pod leaves the roster, then its stream ends
    await act(async () => {
      watchListener({ payload: { type: "Deleted", data: podEntry } });
    });
    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockStreamPodLogs).toHaveBeenCalledTimes(1);
  });

  it("gives up after one retry instead of looping", async () => {
    const { logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });
    await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(2));

    // The resubscribed stream drops too
    await act(async () => {
      logListeners[1]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });
    // Give a would-be third subscribe every chance to appear before asserting
    await act(async () => { await Promise.resolve(); });
    expect(mockStreamPodLogs).toHaveBeenCalledTimes(2);
  });

  // Regression: the retry guard was permanent, so a pod that dropped once was
  // locked out for the rest of the session — a later, unrelated drop after
  // hours of healthy streaming got no reconnect at all.
  it("retries again after a drop that follows a healthy stretch", async () => {
    const { logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
    });
    await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(2));

    // The replacement streams happily well past the loop-guard cooldown
    const realNow = Date.now;
    Date.now = () => realNow() + 60_000;
    try {
      await act(async () => {
        logListeners[1]({ payload: { type: "Ended", data: { reason: "connection reset" } } });
      });
      await waitFor(() => expect(mockStreamPodLogs).toHaveBeenCalledTimes(3));
    } finally {
      Date.now = realNow;
    }
  });

  // A container that simply exited ends cleanly; retrying would fight the pod's
  // own lifecycle instead of a network problem.
  it("does not resubscribe on a clean end of stream", async () => {
    const { logListeners } = await startStreamingOnePod();

    await act(async () => {
      logListeners[0]({ payload: { type: "Ended", data: { reason: null } } });
    });
    await act(async () => { await Promise.resolve(); });

    expect(mockStreamPodLogs).toHaveBeenCalledTimes(1);
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

describe("useWorkloadLogs CronJob resolution", () => {
  const job = (name: string, uid: string, owner: string | null = "nightly") => ({
    name,
    namespace: "default",
    owner_kind: owner === null ? null : "CronJob",
    owner_name: owner,
    selector: { "batch.kubernetes.io/controller-uid": uid },
    selector_query: `batch.kubernetes.io/controller-uid=${uid}`,
  });

  const pod = (name: string, uid: string) => ({
    name,
    uid,
    namespace: "default",
    phase: "Running",
    labels: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockListPods.mockResolvedValue([]);
    mockWatchPods.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    mockListen.mockResolvedValue(jest.fn());
  });

  // A CronJob owns Jobs, not pods. Both Jobs' pods must end up in one view, so
  // their per-Job controller-uid selectors collapse into one set-based query.
  it("unions the pods of every Job the CronJob owns", async () => {
    mockListJobs.mockResolvedValue([
      job("nightly-28900", "uid-a"),
      job("nightly-28901", "uid-b"),
      // Belongs to a different CronJob - must not leak into the query
      job("other-1", "uid-c", "weekly"),
    ]);
    mockListPods.mockResolvedValue([
      pod("nightly-28900-xxxxx", "pod-a"),
      pod("nightly-28901-yyyyy", "pod-b"),
    ]);

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );

    await waitFor(() => expect(result.current.pods).toHaveLength(2));

    expect(mockListPods).toHaveBeenCalledWith({
      namespace: "default",
      label_selector: "batch.kubernetes.io/controller-uid in (uid-a,uid-b)",
    });
    expect(result.current.pods.map((p) => p.name)).toEqual([
      "nightly-28900-xxxxx",
      "nightly-28901-yyyyy",
    ]);
    expect(result.current.error).toBeNull();
  });

  // Regression: the UID was read with a fallback to the pre-1.27 bare
  // `controller-uid` key, but the query was always built with the prefixed
  // one. On older clusters that queried a label no pod carries, so CronJob
  // logs came up empty instead of falling back.
  it("queries the legacy controller-uid key on pre-1.27 clusters", async () => {
    const legacyJob = {
      name: "nightly-28900",
      namespace: "default",
      owner_kind: "CronJob",
      owner_name: "nightly",
      selector: { "controller-uid": "uid-legacy" },
      selector_query: "controller-uid=uid-legacy",
    };
    mockListJobs.mockResolvedValue([legacyJob]);
    mockListPods.mockResolvedValue([pod("nightly-28900-xxxxx", "pod-a")]);

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );

    await waitFor(() => expect(result.current.pods).toHaveLength(1));

    expect(mockListPods).toHaveBeenCalledWith({
      namespace: "default",
      label_selector: "controller-uid in (uid-legacy)",
    });
  });

  it("streams every pod of every owned Job, tagged with its own pod name", async () => {
    mockListJobs.mockResolvedValue([
      job("nightly-28900", "uid-a"),
      job("nightly-28901", "uid-b"),
    ]);
    mockListPods.mockResolvedValue([
      pod("nightly-28900-xxxxx", "pod-a"),
      pod("nightly-28901-yyyyy", "pod-b"),
    ]);
    mockStreamPodLogs.mockResolvedValue(undefined);

    const logListeners: Array<(event: { payload: unknown }) => void> = [];
    mockListen.mockImplementation(
      (eventName: string, handler: (e: { payload: unknown }) => void) => {
        if (eventName.startsWith("log-stream-")) logListeners.push(handler);
        return Promise.resolve(jest.fn());
      }
    );

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );
    await waitFor(() => expect(result.current.pods).toHaveLength(2));

    await act(async () => {
      await result.current.startStream();
    });

    await waitFor(() => expect(logListeners).toHaveLength(2));
    expect(mockStreamPodLogs).toHaveBeenCalledTimes(2);
    expect(mockStreamPodLogs).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pod_name: "nightly-28900-xxxxx" })
    );
    expect(mockStreamPodLogs).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ pod_name: "nightly-28901-yyyyy" })
    );

    act(() => {
      logListeners[0]({
        payload: {
          type: "Line",
          data: {
            message: "from job a",
            timestamp: "2024-01-01T10:00:00Z",
            container: "main",
            pod: "nightly-28900-xxxxx",
            namespace: "default",
          },
        },
      });
      logListeners[1]({
        payload: {
          type: "Line",
          data: {
            message: "from job b",
            timestamp: "2024-01-01T10:00:01Z",
            container: "main",
            pod: "nightly-28901-yyyyy",
            namespace: "default",
          },
        },
      });
    });

    await waitFor(() => expect(result.current.logs).toHaveLength(2));
    expect(result.current.logs.map((l) => [l.pod, l.message])).toEqual([
      ["nightly-28900-xxxxx", "from job a"],
      ["nightly-28901-yyyyy", "from job b"],
    ]);
  });

  // Between runs the history limit can leave a CronJob with no Jobs at all.
  // That is an empty view, not the "not found" error other kinds report.
  it("shows an empty view without erroring when no Jobs are left", async () => {
    mockListJobs.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );
    await act(async () => {});

    expect(result.current.error).toBeNull();
    expect(result.current.pods).toEqual([]);
    expect(mockListPods).not.toHaveBeenCalled();
    expect(mockWatchPods).not.toHaveBeenCalled();
  });

  // An owned Job whose pods are already garbage-collected still resolves; it
  // just contributes no pods.
  it("resolves without error when an owned Job has no pods left", async () => {
    mockListJobs.mockResolvedValue([job("nightly-28900", "uid-a")]);
    mockListPods.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );
    await act(async () => {});

    expect(result.current.error).toBeNull();
    expect(result.current.pods).toEqual([]);
    expect(mockListPods).toHaveBeenCalledWith({
      namespace: "default",
      label_selector: "batch.kubernetes.io/controller-uid in (uid-a)",
    });
  });

  it("ignores Jobs that are not owned by a CronJob", async () => {
    mockListJobs.mockResolvedValue([
      job("nightly-28900", "uid-a"),
      job("standalone", "uid-z", null),
    ]);
    mockListPods.mockResolvedValue([pod("nightly-28900-xxxxx", "pod-a")]);

    const { result } = renderHook(() =>
      useWorkloadLogs("nightly", "default", "cronjob")
    );
    await waitFor(() => expect(result.current.pods).toHaveLength(1));

    expect(mockListPods).toHaveBeenCalledWith({
      namespace: "default",
      label_selector: "batch.kubernetes.io/controller-uid in (uid-a)",
    });
  });
});

describe("supportsAggregatedLogs", () => {
  // CronJobs are included: they own Jobs, not pods, and the extra resolution
  // hop through those Jobs is what cronjobSelectors() does.
  it.each(["deployment", "statefulset", "daemonset", "replicaset", "job", "cronjob"])(
    "accepts %s",
    (kind) => {
      expect(supportsAggregatedLogs(kind)).toBe(true);
    }
  );

  it.each(["pod", "service", "configmap"])("rejects %s", (kind) => {
    expect(supportsAggregatedLogs(kind)).toBe(false);
  });
});
