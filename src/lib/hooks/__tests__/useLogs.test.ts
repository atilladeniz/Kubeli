import { renderHook, act } from "@testing-library/react";
import { useLogs } from "../useLogs";

const storeState = {
  logTabs: {} as Record<string, unknown>,
  initLogTab: jest.fn(),
  cleanupLogTab: jest.fn(),
  setSelectedContainer: jest.fn(),
  stopStream: jest.fn().mockResolvedValue(undefined),
  clearLogs: jest.fn(),
  startStream: jest.fn().mockResolvedValue(undefined),
  fetchLogs: jest.fn(),
};

jest.mock("../../stores/log-store", () => ({
  useLogStore: Object.assign(
    (selector: (s: typeof storeState) => unknown) => selector(storeState),
    { getState: () => storeState }
  ),
}));

jest.mock("../../stores/tabs-store", () => ({
  useTabsStore: (selector: (s: { activeTabId: string }) => unknown) =>
    selector({ activeTabId: "tab1" }),
}));

jest.mock("../../tauri/commands", () => ({
  downloadPodLogs: jest.fn(),
}));

describe("useLogs setSelectedContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storeState.stopStream.mockResolvedValue(undefined);
  });

  // Regression: switching containers stopped the stream and cleared logs but
  // never restarted, leaving the user on an empty, dead view.
  it("restarts the stream with the new container when one was streaming", async () => {
    storeState.logTabs = { tab1: { isStreaming: true, logs: [] } };
    const { result } = renderHook(() => useLogs("default", "my-pod"));

    await act(async () => {
      result.current.setSelectedContainer("sidecar");
    });

    expect(storeState.setSelectedContainer).toHaveBeenCalledWith("tab1", "sidecar");
    expect(storeState.stopStream).toHaveBeenCalledWith("tab1");
    expect(storeState.clearLogs).toHaveBeenCalledWith("tab1");
    expect(storeState.startStream).toHaveBeenCalledWith("tab1", "default", "my-pod", "sidecar");
  });

  it("does not start a stream when none was running", async () => {
    storeState.logTabs = { tab1: { isStreaming: false, logs: [] } };
    const { result } = renderHook(() => useLogs("default", "my-pod"));

    await act(async () => {
      result.current.setSelectedContainer("sidecar");
    });

    expect(storeState.startStream).not.toHaveBeenCalled();
  });
});
