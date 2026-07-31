import { renderHook, act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { useServices } from "../networking";
import { useClusterStore } from "@/lib/stores/cluster-store";

const mockListServices = jest.fn();
const mockWatchServices = jest.fn();
const mockStopWatch = jest.fn();

jest.mock("../../../../tauri/commands", () => ({
  listServices: (...args: unknown[]) => mockListServices(...args),
  listIngresses: jest.fn().mockResolvedValue([]),
  listEndpointSlices: jest.fn().mockResolvedValue([]),
  listNetworkPolicies: jest.fn().mockResolvedValue([]),
  listIngressClasses: jest.fn().mockResolvedValue([]),
  watchServices: (...args: unknown[]) => mockWatchServices(...args),
  stopWatch: (...args: unknown[]) => mockStopWatch(...args),
}));

describe("useServices watch wiring", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockListServices.mockResolvedValue([]);
    mockWatchServices.mockResolvedValue(undefined);
    mockStopWatch.mockResolvedValue(undefined);
    useClusterStore.setState({ isConnected: true, selectedNamespaces: ["default"] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderWithAutoWatch() {
    const rendered = renderHook(() => useServices({ autoWatch: true }));
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

  it("starts a services watch for the selected namespace", async () => {
    const { result } = await renderWithAutoWatch();

    expect(mockWatchServices).toHaveBeenCalledTimes(1);
    expect(mockWatchServices).toHaveBeenCalledWith(
      expect.stringContaining("services-"),
      "default"
    );
    expect(result.current.isWatching).toBe(true);
  });

  it("listens on the services-watch event channel emitted by the backend", async () => {
    await renderWithAutoWatch();

    const watchId = mockWatchServices.mock.calls[0][0] as string;
    expect(listen).toHaveBeenCalledWith(`services-watch-${watchId}`, expect.any(Function));
  });
});

function flushPromises() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
    jest.advanceTimersByTime(0);
  });
}
