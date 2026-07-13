import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useDeploymentLogs } from "../useDeploymentLogs";

const mockListPods = jest.fn();
const mockListDeployments = jest.fn();
const mockWatchPods = jest.fn();
const mockStopWatch = jest.fn();

jest.mock("../../tauri/commands", () => ({
  listPods: (...args: unknown[]) => mockListPods(...args),
  listDeployments: (...args: unknown[]) => mockListDeployments(...args),
  streamPodLogs: jest.fn(),
  stopLogStream: jest.fn().mockResolvedValue(undefined),
  watchPods: (...args: unknown[]) => mockWatchPods(...args),
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

const mockListen = listen as jest.Mock;

describe("useDeploymentLogs unmount during watch setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListDeployments.mockResolvedValue([]);
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

    const { unmount } = renderHook(() => useDeploymentLogs("demo-web", "default"));
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

    const { unmount } = renderHook(() => useDeploymentLogs("demo-web", "default"));
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
      expect.stringContaining("deploy-pods-default-demo-web")
    );
  });
});
