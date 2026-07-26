import { useLogStore, type LogTabState } from "../log-store";

// Mock Tauri commands
const mockStreamPodLogs = jest.fn();
const mockStopLogStream = jest.fn();

const mockUnlisten = jest.fn();
jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn().mockImplementation(() => Promise.resolve(mockUnlisten)),
}));

jest.mock("../../tauri/commands", () => ({
  getPodLogs: jest.fn(),
  streamPodLogs: (...args: unknown[]) => mockStreamPodLogs(...args),
  stopLogStream: (...args: unknown[]) => mockStopLogStream(...args),
  getPodContainers: jest.fn(),
  watchPods: jest.fn(),
  stopWatch: jest.fn().mockResolvedValue(undefined),
}));

function makeTabState(): LogTabState {
  return {
    logs: [],
    isStreaming: false,
    isLoading: false,
    error: null,
    containers: [],
    selectedContainer: null,
    streamId: null,
    scrollTop: 0,
    autoScroll: true,
    ended: null,
  };
}

describe("log-store startStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamPodLogs.mockResolvedValue(undefined);
    mockStopLogStream.mockResolvedValue(undefined);
    useLogStore.setState({
      logTabs: { tab1: makeTabState() },
    });
  });

  // Regression: isStreaming only turns true after an await, so two rapid
  // calls for the same tab both passed the guard and started two backend
  // streams (the second one first tearing down the half-started first).
  it("starts only one stream when called twice rapidly for the same tab", async () => {
    const { startStream } = useLogStore.getState();

    await Promise.all([
      startStream("tab1", "default", "my-pod"),
      startStream("tab1", "default", "my-pod"),
    ]);

    expect(mockStreamPodLogs).toHaveBeenCalledTimes(1);
    expect(mockStopLogStream).not.toHaveBeenCalled();
  });

  it("allows starting again after a failed start", async () => {
    mockStreamPodLogs.mockRejectedValueOnce(new Error("boom"));

    await useLogStore.getState().startStream("tab1", "default", "my-pod");
    expect(useLogStore.getState().logTabs.tab1.error).not.toBeNull();

    await useLogStore.getState().startStream("tab1", "default", "my-pod");
    expect(mockStreamPodLogs).toHaveBeenCalledTimes(2);
  });
});

describe("log-store stream resume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamPodLogs.mockResolvedValue(undefined);
    mockStopLogStream.mockResolvedValue(undefined);
    useLogStore.setState({ logTabs: { tab1: makeTabState() } });
  });

  const optionsOfLastCall = () =>
    mockStreamPodLogs.mock.calls.at(-1)?.[1] as Record<string, unknown>;

  it("tails the log on a normal start", async () => {
    await useLogStore.getState().startStream("tab1", "default", "my-pod");

    const options = optionsOfLastCall();
    expect(options.tail_lines).toBe(100);
    expect(options.since_seconds).toBeUndefined();
  });

  // Sending both would cap the resume: the API applies tail_lines within the
  // since_seconds window, returning only the last N lines of the gap.
  it("resumes from a point in time without also tailing", async () => {
    await useLogStore
      .getState()
      .startStream("tab1", "default", "my-pod", undefined, undefined, 42);

    const options = optionsOfLastCall();
    expect(options.since_seconds).toBe(42);
    expect(options.tail_lines).toBeUndefined();
  });

  it("clears a previous end notice when the stream restarts", async () => {
    useLogStore.setState({
      logTabs: {
        tab1: { ...makeTabState(), ended: { reason: "connection reset" } },
      },
    });

    await useLogStore.getState().startStream("tab1", "default", "my-pod");

    expect(useLogStore.getState().logTabs.tab1.ended).toBeNull();
  });
});

describe("log-store listener cleanup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamPodLogs.mockResolvedValue(undefined);
    mockStopLogStream.mockResolvedValue(undefined);
    useLogStore.setState({ logTabs: { tab1: makeTabState() } });
  });

  // Regression: a stream that ended on its own leaves streamId null, so
  // stopStream returns early without unsubscribing. Reconnecting then
  // overwrote the stored unlisten handle, leaking one listener per cycle.
  it("unsubscribes the previous listener when reconnecting after an end", async () => {
    await useLogStore.getState().startStream("tab1", "default", "my-pod");

    // Simulate the stream ending on its own: Stopped clears streamId
    useLogStore.setState((s) => ({
      logTabs: {
        ...s.logTabs,
        tab1: {
          ...s.logTabs.tab1,
          isStreaming: false,
          streamId: null,
          ended: { reason: "connection reset" },
        },
      },
    }));

    mockUnlisten.mockClear();

    await useLogStore
      .getState()
      .startStream("tab1", "default", "my-pod", undefined, undefined, 30);

    // Without the explicit unsubscribe, the old handle is simply overwritten
    expect(mockUnlisten).toHaveBeenCalledTimes(1);
  });
});
