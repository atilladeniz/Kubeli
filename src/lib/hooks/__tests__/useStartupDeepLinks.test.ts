import { renderHook, waitFor } from "@testing-library/react";
import { useStartupDeepLinks } from "../useStartupDeepLinks";
import { useClusterStore } from "@/lib/stores/cluster-store";

const mockTakeStartupDeepLinks = jest.fn();
jest.mock("@/lib/tauri/commands", () => ({
  takeStartupDeepLinks: () => mockTakeStartupDeepLinks(),
}));
jest.mock("@/components/layout/tabbar", () => ({
  useTabTitle: () => (view: string) => view,
}));

describe("useStartupDeepLinks startup reconnect", () => {
  const reconnectOnStartup = jest.fn().mockResolvedValue(undefined);
  const fetchClusters = jest.fn().mockResolvedValue(undefined);
  const connect = jest.fn().mockResolvedValue({ connected: true });

  beforeEach(() => {
    jest.clearAllMocks();
    useClusterStore.setState({ reconnectOnStartup, fetchClusters, connect });
  });

  it("reconnects to the last cluster when no deep link arrived", async () => {
    mockTakeStartupDeepLinks.mockResolvedValue([]);

    renderHook(() => useStartupDeepLinks(true));

    await waitFor(() => expect(reconnectOnStartup).toHaveBeenCalledTimes(1));
    expect(connect).not.toHaveBeenCalled();
  });

  // A kubeli://connect/<ctx> launch must win over the remembered cluster
  it("does not reconnect when a deep link connects somewhere", async () => {
    mockTakeStartupDeepLinks.mockResolvedValue([{ kind: "connect", context: "other" }]);

    renderHook(() => useStartupDeepLinks(true));

    await waitFor(() => expect(connect).toHaveBeenCalledWith("other"));
    expect(reconnectOnStartup).not.toHaveBeenCalled();
  });

  it("does nothing outside Tauri", async () => {
    mockTakeStartupDeepLinks.mockResolvedValue([]);

    renderHook(() => useStartupDeepLinks(false));

    await new Promise((r) => setTimeout(r, 0));
    expect(reconnectOnStartup).not.toHaveBeenCalled();
  });
});
