import { render, act } from "@testing-library/react";
import { TrayApp } from "../TrayApp";
import { listen } from "@tauri-apps/api/event";

jest.mock("../TrayPopup", () => ({
  TrayPopup: () => null,
}));

const mockListenResolvers: Array<(fn: () => void) => void> = [];
jest.mock("@tauri-apps/api/event", () => ({
  listen: jest.fn(
    () =>
      new Promise((resolve) => {
        mockListenResolvers.push(resolve as (fn: () => void) => void);
      })
  ),
}));

jest.mock("@/lib/tauri/commands/cluster", () => ({
  getConnectionStatus: jest.fn().mockResolvedValue({ connected: false }),
}));

jest.mock("@/lib/stores/cluster-store", () => {
  const state = {
    clusters: [],
    // Keep initialization pending so TrayApp stays on the loading screen
    fetchClusters: jest.fn(() => new Promise(() => {})),
    fetchNamespaces: jest.fn().mockResolvedValue(undefined),
  };
  const useClusterStore = (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(state) : state;
  useClusterStore.getState = () => state;
  useClusterStore.setState = jest.fn();
  return { useClusterStore };
});

jest.mock("@/lib/stores/portforward-store", () => {
  const state = {
    initialize: jest.fn().mockResolvedValue(undefined),
  };
  const usePortForwardStore = (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(state) : state;
  usePortForwardStore.getState = () => state;
  usePortForwardStore.persist = { rehydrate: jest.fn() };
  return { usePortForwardStore };
});

jest.mock("@/lib/stores/ui-store", () => {
  const state = { settings: {} };
  const useUIStore = (selector?: (s: Record<string, unknown>) => unknown) =>
    selector ? selector(state) : state;
  useUIStore.getState = () => state;
  useUIStore.setState = jest.fn();
  return { useUIStore };
});

describe("TrayApp event listener lifecycle", () => {
  beforeEach(() => {
    mockListenResolvers.length = 0;
    (listen as jest.Mock).mockClear();
  });

  it("registers tray listeners on mount", async () => {
    render(<TrayApp />);
    // Flush the dynamic import of @tauri-apps/api/event
    await act(async () => {});

    const events = (listen as jest.Mock).mock.calls.map((call) => call[0]);
    expect(events).toContain("tray-popup-shown");
    expect(events).toContain("theme-changed");
  });

  it("detaches listeners that resolve after unmount", async () => {
    const { unmount } = render(<TrayApp />);
    await act(async () => {});
    expect(mockListenResolvers).toHaveLength(2);

    unmount();

    // Regression: listen() promises resolving after unmount used to leak
    // their listeners because the stored unlisten was never called.
    const unlistenA = jest.fn();
    const unlistenB = jest.fn();
    await act(async () => {
      mockListenResolvers[0](unlistenA);
      mockListenResolvers[1](unlistenB);
    });

    expect(unlistenA).toHaveBeenCalledTimes(1);
    expect(unlistenB).toHaveBeenCalledTimes(1);
  });
});
