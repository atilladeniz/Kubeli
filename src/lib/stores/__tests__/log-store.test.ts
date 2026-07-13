import { useLogStore, type LogTabState } from "../log-store";

// Mock Tauri commands
const mockStreamPodLogs = jest.fn();
const mockStopLogStream = jest.fn();

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
  };
}

describe("log-store startStream", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStreamPodLogs.mockResolvedValue(undefined);
    mockStopLogStream.mockResolvedValue(undefined);
    useLogStore.setState({
      activeTabId: null,
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
