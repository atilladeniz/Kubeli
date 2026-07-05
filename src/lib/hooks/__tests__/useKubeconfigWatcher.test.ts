import { renderHook, act } from "@testing-library/react";
import { useKubeconfigWatcher } from "../useKubeconfigWatcher";

const mockWatch = jest.fn();
jest.mock("@tauri-apps/plugin-fs", () => ({
  watch: (...args: unknown[]) => mockWatch(...args),
}));
jest.mock("@tauri-apps/api/path", () => ({
  homeDir: jest.fn().mockResolvedValue("/home/user/"),
}));

const mockGetKubeconfigSources = jest.fn();
jest.mock("../../tauri/commands", () => ({
  getKubeconfigSources: () => mockGetKubeconfigSources(),
}));

const mockFetchClusters = jest.fn();
jest.mock("../../stores/cluster-store", () => ({
  useClusterStore: (selector: (s: { fetchClusters: () => void }) => unknown) =>
    selector({ fetchClusters: mockFetchClusters }),
}));

const flush = () => act(async () => {});

describe("useKubeconfigWatcher", () => {
  beforeEach(() => jest.clearAllMocks());

  it("keeps working watchers when one path fails (e.g. outside fs scope)", async () => {
    mockGetKubeconfigSources.mockResolvedValue({
      sources: [
        { path: "/outside/kubeconfigs", source_type: "folder" },
        { path: "/home/user/.kube", source_type: "folder" },
      ],
      merge_mode: false,
    });

    const unwatchOk = jest.fn();
    let changeCallback: (() => void) | undefined;
    mockWatch.mockImplementation((path: string, cb: () => void) => {
      if (path === "/outside/kubeconfigs") {
        return Promise.reject(new Error("forbidden path"));
      }
      changeCallback = cb;
      return Promise.resolve(unwatchOk);
    });

    const { unmount } = renderHook(() => useKubeconfigWatcher());
    await flush();

    // Both paths attempted individually — the rejected one must not
    // prevent the surviving watcher from firing.
    expect(mockWatch).toHaveBeenCalledTimes(2);
    expect(changeCallback).toBeDefined();
    changeCallback!();
    expect(mockFetchClusters).toHaveBeenCalledTimes(1);

    unmount();
    expect(unwatchOk).toHaveBeenCalledTimes(1);
  });

  it("falls back to watching ~/.kube when no sources are configured", async () => {
    mockGetKubeconfigSources.mockResolvedValue({ sources: [], merge_mode: false });
    mockWatch.mockResolvedValue(jest.fn());

    renderHook(() => useKubeconfigWatcher());
    await flush();

    expect(mockWatch).toHaveBeenCalledTimes(1);
    expect(mockWatch.mock.calls[0][0]).toBe("/home/user/.kube");
  });
});
