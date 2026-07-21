import { act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePortForwardStore, getReconnectStartTime } from "../portforward-store";
import type { PortForwardInfo, PortForwardEvent, PortForwardHistoryItem } from "@/lib/types";

// Mock Tauri commands
const mockPortforwardStart = jest.fn();
const mockPortforwardStop = jest.fn();
const mockPortforwardList = jest.fn();
const mockPortforwardCheckPort = jest.fn();

jest.mock("../../tauri/commands", () => ({
  portforwardStart: (...args: unknown[]) => mockPortforwardStart(...args),
  portforwardStop: (...args: unknown[]) => mockPortforwardStop(...args),
  portforwardList: () => mockPortforwardList(),
  portforwardCheckPort: (...args: unknown[]) => mockPortforwardCheckPort(...args),
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockToast = require("sonner").toast as {
  success: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  warning: jest.Mock;
};

// Mock ui-store
jest.mock("../ui-store", () => ({
  useUIStore: {
    getState: () => ({
      settings: { portForwardOpenBrowser: "never" },
      updateSettings: jest.fn(),
    }),
  },
}));

// Mock cluster-store
jest.mock("../cluster-store", () => ({
  useClusterStore: {
    getState: jest.fn(() => ({
      currentCluster: { context: "test-cluster" },
    })),
  },
}));

// Capture the listen callback so we can simulate events
let listenCallback: ((event: { payload: PortForwardEvent }) => void) | null = null;
const mockUnlisten = jest.fn();

(listen as jest.Mock).mockImplementation((_eventName: string, cb: (event: { payload: PortForwardEvent }) => void) => {
  listenCallback = cb;
  return Promise.resolve(mockUnlisten);
});

function simulateEvent(event: PortForwardEvent) {
  if (listenCallback) {
    listenCallback({ payload: event });
  }
}

// Test data
const mockForward: PortForwardInfo = {
  forward_id: "svc-default-test-svc-8080-123",
  cluster_context: "test-cluster",
  namespace: "default",
  name: "test-svc",
  target_type: "service",
  target_port: 8080,
  local_port: 41587,
  status: "connected",
  pod_name: "test-pod-abc",
  pod_uid: "uid-123",
};

const mockHistoryItem: PortForwardHistoryItem = {
  id: "hist-test-1",
  signature: "test-cluster|default|service|test-svc|8080",
  cluster_context: "test-cluster",
  forward_id: mockForward.forward_id,
  namespace: "default",
  name: "test-svc",
  target_type: "service",
  requested_port: 8080,
  target_port: 8080,
  local_port: 41587,
  status: "inactive",
  started_at: 1000000,
  updated_at: 1000000,
};

const defaultState = {
  forwards: [],
  history: [],
  isLoading: false,
  error: null,
  listeners: new Map(),
  initialized: false,
  pendingBrowserOpen: null,
  pendingForwardRequest: null,
};

describe("PortForwardStore", () => {
  beforeEach(() => {
    usePortForwardStore.setState(defaultState);
    listenCallback = null;
    jest.clearAllMocks();
  });

  describe("startForward error cleanup", () => {
    it("removes only the failed attempt's placeholder, not sibling forwards", async () => {
      // Existing healthy forward to a *prefix-colliding* target port (80 vs 8080)
      const sibling: PortForwardInfo = {
        ...mockForward,
        forward_id: "pod-demo-web-8080-111",
        target_port: 8080,
      };
      // Existing healthy forward to the SAME target (different attempt)
      const sameTarget: PortForwardInfo = {
        ...mockForward,
        forward_id: "pod-demo-web-80-222",
        target_port: 80,
      };
      usePortForwardStore.setState({ forwards: [sibling, sameTarget] });

      mockPortforwardStart.mockRejectedValue(new Error("port busy"));

      await act(async () => {
        await usePortForwardStore
          .getState()
          .startForward("demo", "web", "pod", 80);
      });

      const ids = usePortForwardStore.getState().forwards.map((f) => f.forward_id);
      // The failed placeholder is gone...
      expect(ids).toHaveLength(2);
      // ...but both pre-existing forwards survive (old prefix-match killed them)
      expect(ids).toContain("pod-demo-web-8080-111");
      expect(ids).toContain("pod-demo-web-80-222");
      expect(usePortForwardStore.getState().error).toBe("port busy");
    });

    // Regression: the listener registered before portforwardStart never gets
    // a Stopped event when the start fails (e.g. expected_context mismatch),
    // so it leaked with every failed attempt.
    it("drops the event listener registered for a start that failed", async () => {
      mockPortforwardStart.mockRejectedValue(
        new Error("Port forward targets cluster a but b is connected")
      );

      await act(async () => {
        await usePortForwardStore.getState().startForward("demo", "web", "pod", 80);
      });

      expect(mockUnlisten).toHaveBeenCalled();
      expect(usePortForwardStore.getState().listeners.size).toBe(0);
    });
  });

  describe("startForward placeholder tagging", () => {
    // Regression: the optimistic placeholder was always tagged with the
    // ACTIVE cluster. During a pinned restart (OIDC/history) with a cluster
    // switch mid-flight, it transiently showed up under the wrong cluster.
    it("tags a pinned restart's placeholder with the expected cluster, not the active one", async () => {
      let resolveStart!: (value: PortForwardInfo) => void;
      const startGate = new Promise<PortForwardInfo>((resolve) => (resolveStart = resolve));
      mockPortforwardStart.mockReturnValue(startGate);

      let startPromise: Promise<PortForwardInfo | null> = Promise.resolve(null);
      act(() => {
        startPromise = usePortForwardStore
          .getState()
          .startForward("demo", "web", "pod", 80, undefined, undefined, undefined, "other-cluster");
      });

      // The placeholder is set synchronously, before the backend call - it
      // must already carry the pinned cluster (the active one is
      // "test-cluster").
      const placeholder = usePortForwardStore.getState().forwards.find((f) => f.name === "web");
      expect(placeholder?.cluster_context).toBe("other-cluster");

      await act(async () => {
        resolveStart({
          ...mockForward,
          forward_id: placeholder!.forward_id,
          cluster_context: "other-cluster",
        });
        await startPromise;
      });
    });
  });

  describe("updateForwardStatus", () => {
    it("should update forward status by id", () => {
      usePortForwardStore.setState({ forwards: [{ ...mockForward }] });

      act(() => {
        usePortForwardStore.getState().updateForwardStatus(mockForward.forward_id, "reconnecting");
      });

      const forward = usePortForwardStore.getState().forwards[0];
      expect(forward.status).toBe("reconnecting");
    });

    it("should not affect other forwards", () => {
      const otherForward = { ...mockForward, forward_id: "other-id", name: "other-svc" };
      usePortForwardStore.setState({ forwards: [{ ...mockForward }, otherForward] });

      act(() => {
        usePortForwardStore.getState().updateForwardStatus(mockForward.forward_id, "error");
      });

      const state = usePortForwardStore.getState();
      expect(state.forwards[0].status).toBe("error");
      expect(state.forwards[1].status).toBe("connected");
    });
  });

  describe("removeForward", () => {
    it("should remove forward by id", () => {
      usePortForwardStore.setState({ forwards: [{ ...mockForward }] });

      act(() => {
        usePortForwardStore.getState().removeForward(mockForward.forward_id);
      });

      expect(usePortForwardStore.getState().forwards).toHaveLength(0);
    });
  });

  describe("getForward", () => {
    it("should return forward by id", () => {
      usePortForwardStore.setState({ forwards: [{ ...mockForward }] });

      const found = usePortForwardStore.getState().getForward(mockForward.forward_id);
      expect(found).toEqual(mockForward);
    });

    it("should return undefined for unknown id", () => {
      const found = usePortForwardStore.getState().getForward("nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("setError", () => {
    it("should set error message", () => {
      act(() => {
        usePortForwardStore.getState().setError("Something went wrong");
      });

      expect(usePortForwardStore.getState().error).toBe("Something went wrong");
    });

    it("should clear error with null", () => {
      usePortForwardStore.setState({ error: "old error" });

      act(() => {
        usePortForwardStore.getState().setError(null);
      });

      expect(usePortForwardStore.getState().error).toBeNull();
    });
  });

  describe("cleanup", () => {
    it("should unlisten all listeners and clear forwards", () => {
      const unlisten1 = jest.fn();
      const unlisten2 = jest.fn();
      const listeners = new Map([
        ["id1", unlisten1],
        ["id2", unlisten2],
      ]);

      usePortForwardStore.setState({ forwards: [{ ...mockForward }], listeners });

      act(() => {
        usePortForwardStore.getState().cleanup();
      });

      expect(unlisten1).toHaveBeenCalled();
      expect(unlisten2).toHaveBeenCalled();
      const state = usePortForwardStore.getState();
      expect(state.forwards).toHaveLength(0);
      expect(state.listeners.size).toBe(0);
    });
  });

  describe("initialize", () => {
    it("should only initialize once", async () => {
      mockPortforwardList.mockResolvedValue([]);

      await act(async () => {
        await usePortForwardStore.getState().initialize();
      });
      await act(async () => {
        await usePortForwardStore.getState().initialize();
      });

      expect(mockPortforwardList).toHaveBeenCalledTimes(1);
    });

    it("should set initialized flag", async () => {
      mockPortforwardList.mockResolvedValue([]);

      await act(async () => {
        await usePortForwardStore.getState().initialize();
      });

      expect(usePortForwardStore.getState().initialized).toBe(true);
    });
  });

  describe("refreshForwards", () => {
    it("should fetch forwards from backend", async () => {
      mockPortforwardList.mockResolvedValue([mockForward]);

      await act(async () => {
        await usePortForwardStore.getState().refreshForwards();
      });

      expect(usePortForwardStore.getState().forwards).toEqual([mockForward]);
    });

    it("should handle errors gracefully", async () => {
      mockPortforwardList.mockRejectedValue(new Error("Connection lost"));

      await act(async () => {
        await usePortForwardStore.getState().refreshForwards();
      });

      // Should not throw, forwards remain empty
      expect(usePortForwardStore.getState().forwards).toEqual([]);
    });

    it("should preserve frontend-only fields (requested_port, port_name) on refresh", async () => {
      // Seed store with a forward that has frontend-only fields
      const forwardWithFrontendFields: PortForwardInfo = {
        ...mockForward,
        requested_port: 80,
        port_name: "http",
      };
      usePortForwardStore.setState({ forwards: [forwardWithFrontendFields] });

      // Backend returns the same forward without frontend-only fields
       
      const { requested_port: _, port_name: __, ...backendForward } = forwardWithFrontendFields;
      mockPortforwardList.mockResolvedValue([backendForward]);

      await act(async () => {
        await usePortForwardStore.getState().refreshForwards();
      });

      const refreshed = usePortForwardStore.getState().forwards[0];
      expect(refreshed.requested_port).toBe(80);
      expect(refreshed.port_name).toBe("http");
    });
  });

  describe("startForward", () => {
    it("should add placeholder and update with actual info", async () => {
      mockPortforwardStart.mockResolvedValue({ ...mockForward, local_port: 55555 });

      await act(async () => {
        await usePortForwardStore.getState().startForward(
          "default", "test-svc", "service", 8080
        );
      });

      const state = usePortForwardStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.forwards).toHaveLength(1);
      expect(state.forwards[0].local_port).toBe(55555);
    });

    it("should update target_port from backend response (resolved port)", async () => {
      // Simulate: frontend sends service port 80, backend resolves to container port 3000
      mockPortforwardStart.mockResolvedValue({
        ...mockForward,
        forward_id: "svc-demo-frontend-svc-80-123",
        name: "demo-frontend-svc",
        target_port: 3000,  // Backend resolved: service 80 → container 3000
        local_port: 44789,
        pod_name: "demo-frontend-abc",
        pod_uid: "uid-frontend-123",
      });

      await act(async () => {
        await usePortForwardStore.getState().startForward(
          "demo", "demo-frontend-svc", "service", 80  // Frontend sends service port 80
        );
      });

      const state = usePortForwardStore.getState();
      expect(state.forwards).toHaveLength(1);
      const forward = state.forwards[0];
      // Must show resolved container port, not service port
      expect(forward.target_port).toBe(3000);
      expect(forward.local_port).toBe(44789);
      expect(forward.pod_name).toBe("demo-frontend-abc");
      expect(forward.pod_uid).toBe("uid-frontend-123");
    });

    it("should remove placeholder on error", async () => {
      mockPortforwardStart.mockRejectedValue(new Error("Port in use"));

      await act(async () => {
        const result = await usePortForwardStore.getState().startForward(
          "default", "test-svc", "service", 8080
        );
        expect(result).toBeNull();
      });

      const state = usePortForwardStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe("Port in use");
      expect(state.forwards).toHaveLength(0);
    });
  });

  describe("stopForward", () => {
    it("should call backend stop", async () => {
      mockPortforwardStop.mockResolvedValue(undefined);

      await act(async () => {
        await usePortForwardStore.getState().stopForward("test-id");
      });

      expect(mockPortforwardStop).toHaveBeenCalledWith("test-id");
    });

    it("should set error on failure", async () => {
      mockPortforwardStop.mockRejectedValue(new Error("Stop failed"));

      await act(async () => {
        await usePortForwardStore.getState().stopForward("test-id");
      });

      expect(usePortForwardStore.getState().error).toBe("Stop failed");
    });
  });

  describe("checkPort", () => {
    it("should return true for available port", async () => {
      mockPortforwardCheckPort.mockResolvedValue(true);

      let result: boolean = false;
      await act(async () => {
        result = await usePortForwardStore.getState().checkPort(8080);
      });

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      mockPortforwardCheckPort.mockRejectedValue(new Error("check failed"));

      let result: boolean = true;
      await act(async () => {
        result = await usePortForwardStore.getState().checkPort(8080);
      });

      expect(result).toBe(false);
    });
  });

  describe("event handling", () => {
    beforeEach(async () => {
      usePortForwardStore.setState({ forwards: [{ ...mockForward, status: "connecting" }] });
      // Setup listener to capture the callback
      await act(async () => {
        await usePortForwardStore.getState().setupListener(mockForward.forward_id);
      });
    });

    describe("Started event", () => {
      it("should update status to connecting and set local_port", () => {
        act(() => {
          simulateEvent({
            type: "Started",
            data: { forward_id: mockForward.forward_id, local_port: 12345 },
          } as PortForwardEvent);
        });

        const forward = usePortForwardStore.getState().forwards[0];
        expect(forward.status).toBe("connecting");
        expect(forward.local_port).toBe(12345);
      });
    });

    describe("Connected event", () => {
      it("should update status to connected and show toast", () => {
        act(() => {
          simulateEvent({
            type: "Connected",
            data: { forward_id: mockForward.forward_id },
          } as PortForwardEvent);
        });

        const forward = usePortForwardStore.getState().forwards[0];
        expect(forward.status).toBe("connected");
        expect(mockToast.success).toHaveBeenCalledWith(
          "Port forward connected",
          expect.objectContaining({ description: expect.any(String) })
        );
      });

      it("should skip toast and browser dialog after reconnect", () => {
        // Simulate Reconnecting first (populates recentlyReconnected set)
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
          } as PortForwardEvent);
        });

        mockToast.success.mockClear();
        mockToast.info.mockClear();

        // Now Connected should be skipped
        act(() => {
          simulateEvent({
            type: "Connected",
            data: { forward_id: mockForward.forward_id },
          } as PortForwardEvent);
        });

        // Status still updated to connected
        expect(usePortForwardStore.getState().forwards[0].status).toBe("connected");
        // But no success toast for "connected" (the reconnecting toast was separate)
        expect(mockToast.success).not.toHaveBeenCalled();
        // No browser dialog
        expect(usePortForwardStore.getState().pendingBrowserOpen).toBeNull();
      });
    });

    describe("Reconnecting event", () => {
      it("should update status to reconnecting", () => {
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
          } as PortForwardEvent);
        });

        expect(usePortForwardStore.getState().forwards[0].status).toBe("reconnecting");
      });

      it("should show info toast with reason", () => {
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod terminated" },
          } as PortForwardEvent);
        });

        expect(mockToast.info).toHaveBeenCalledWith("Port forward reconnecting", {
          description: "Pod terminated",
        });
      });

      it("should store reconnect start time", () => {
        const before = Date.now();

        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
          } as PortForwardEvent);
        });

        const startTime = getReconnectStartTime(mockForward.forward_id);
        expect(startTime).toBeDefined();
        expect(startTime).toBeGreaterThanOrEqual(before);
        expect(startTime).toBeLessThanOrEqual(Date.now());
      });
    });

    describe("Reconnected event", () => {
      it("should update status to connected and set new pod name", () => {
        act(() => {
          simulateEvent({
            type: "Reconnected",
            data: { forward_id: mockForward.forward_id, new_pod: "test-pod-xyz" },
          } as PortForwardEvent);
        });

        const forward = usePortForwardStore.getState().forwards[0];
        expect(forward.status).toBe("connected");
        expect(forward.pod_name).toBe("test-pod-xyz");
      });

      it("should show success toast with new pod name", () => {
        act(() => {
          simulateEvent({
            type: "Reconnected",
            data: { forward_id: mockForward.forward_id, new_pod: "test-pod-xyz" },
          } as PortForwardEvent);
        });

        expect(mockToast.success).toHaveBeenCalledWith("Port forward reconnected", {
          description: "Connected to new pod: test-pod-xyz",
        });
      });

      it("should clear reconnect start time", () => {
        // Set reconnecting first
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
          } as PortForwardEvent);
        });

        expect(getReconnectStartTime(mockForward.forward_id)).toBeDefined();

        // Now reconnected
        act(() => {
          simulateEvent({
            type: "Reconnected",
            data: { forward_id: mockForward.forward_id, new_pod: "test-pod-new" },
          } as PortForwardEvent);
        });

        expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
      });
    });

    describe("PodDied event", () => {
      it("should set status to disconnected", () => {
        act(() => {
          simulateEvent({
            type: "PodDied",
            data: { forward_id: mockForward.forward_id, pod_name: "test-pod-abc" },
          } as PortForwardEvent);
        });

        expect(usePortForwardStore.getState().forwards[0].status).toBe("disconnected");
      });

      it("should show warning toast with pod name", () => {
        act(() => {
          simulateEvent({
            type: "PodDied",
            data: { forward_id: mockForward.forward_id, pod_name: "test-pod-abc" },
          } as PortForwardEvent);
        });

        expect(mockToast.warning).toHaveBeenCalledWith("Port forward lost", {
          description: "Pod test-pod-abc was removed. No replacement found.",
        });
      });

      it("should clear reconnect start time", () => {
        // Set reconnecting first
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
          } as PortForwardEvent);
        });

        act(() => {
          simulateEvent({
            type: "PodDied",
            data: { forward_id: mockForward.forward_id, pod_name: "test-pod-abc" },
          } as PortForwardEvent);
        });

        expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
      });
    });

    describe("Disconnected event", () => {
      it("should set status to disconnected and clear reconnect time", () => {
        // Set reconnecting first
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "test" },
          } as PortForwardEvent);
        });

        act(() => {
          simulateEvent({
            type: "Disconnected",
            data: { forward_id: mockForward.forward_id },
          } as PortForwardEvent);
        });

        expect(usePortForwardStore.getState().forwards[0].status).toBe("disconnected");
        expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
      });
    });

    describe("Error event", () => {
      it("should set status to error and store error message", () => {
        act(() => {
          simulateEvent({
            type: "Error",
            data: { forward_id: mockForward.forward_id, message: "Connection refused" },
          } as PortForwardEvent);
        });

        const state = usePortForwardStore.getState();
        expect(state.forwards[0].status).toBe("error");
        expect(state.error).toBe("Connection refused");
        expect(mockToast.error).toHaveBeenCalledWith("Port forward error", {
          description: "Connection refused",
        });
      });

      it("should clear reconnect start time", () => {
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "test" },
          } as PortForwardEvent);
        });

        act(() => {
          simulateEvent({
            type: "Error",
            data: { forward_id: mockForward.forward_id, message: "fail" },
          } as PortForwardEvent);
        });

        expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
      });
    });

    describe("Stopped event", () => {
      it("should remove forward and clean up listener", () => {
        act(() => {
          simulateEvent({
            type: "Stopped",
            data: { forward_id: mockForward.forward_id },
          } as PortForwardEvent);
        });

        expect(usePortForwardStore.getState().forwards).toHaveLength(0);
        expect(mockUnlisten).toHaveBeenCalled();
      });

      it("should clear reconnect start time", () => {
        act(() => {
          simulateEvent({
            type: "Reconnecting",
            data: { forward_id: mockForward.forward_id, reason: "test" },
          } as PortForwardEvent);
        });

        act(() => {
          simulateEvent({
            type: "Stopped",
            data: { forward_id: mockForward.forward_id },
          } as PortForwardEvent);
        });

        expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
      });
    });
  });

  describe("reconnect lifecycle", () => {
    beforeEach(async () => {
      usePortForwardStore.setState({ forwards: [{ ...mockForward, status: "connected" }] });
      await act(async () => {
        await usePortForwardStore.getState().setupListener(mockForward.forward_id);
      });
    });

    it("should handle full reconnect flow: connected -> reconnecting -> reconnected", () => {
      // Pod dies, backend sends Reconnecting
      act(() => {
        simulateEvent({
          type: "Reconnecting",
          data: { forward_id: mockForward.forward_id, reason: "Pod test-pod-abc was deleted" },
        } as PortForwardEvent);
      });

      expect(usePortForwardStore.getState().forwards[0].status).toBe("reconnecting");
      expect(getReconnectStartTime(mockForward.forward_id)).toBeDefined();

      // Backend finds new pod, sends Reconnected
      act(() => {
        simulateEvent({
          type: "Reconnected",
          data: { forward_id: mockForward.forward_id, new_pod: "test-pod-def" },
        } as PortForwardEvent);
      });

      const forward = usePortForwardStore.getState().forwards[0];
      expect(forward.status).toBe("connected");
      expect(forward.pod_name).toBe("test-pod-def");
      expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();

      // Connected event after reconnect should be suppressed
      mockToast.success.mockClear();
      act(() => {
        simulateEvent({
          type: "Connected",
          data: { forward_id: mockForward.forward_id },
        } as PortForwardEvent);
      });

      // No additional "connected" toast
      expect(mockToast.success).not.toHaveBeenCalled();
      expect(usePortForwardStore.getState().pendingBrowserOpen).toBeNull();
    });

    it("should handle reconnect failure: connected -> reconnecting -> PodDied", () => {
      act(() => {
        simulateEvent({
          type: "Reconnecting",
          data: { forward_id: mockForward.forward_id, reason: "Pod deleted" },
        } as PortForwardEvent);
      });

      expect(usePortForwardStore.getState().forwards[0].status).toBe("reconnecting");

      // No replacement found
      act(() => {
        simulateEvent({
          type: "PodDied",
          data: { forward_id: mockForward.forward_id, pod_name: "test-pod-abc" },
        } as PortForwardEvent);
      });

      expect(usePortForwardStore.getState().forwards[0].status).toBe("disconnected");
      expect(mockToast.warning).toHaveBeenCalled();
      expect(getReconnectStartTime(mockForward.forward_id)).toBeUndefined();
    });
  });

  describe("browser dialog", () => {
    it("confirmOpenBrowser should open URL and clear pending", () => {
      (openUrl as jest.Mock).mockResolvedValue(undefined);
      usePortForwardStore.setState({
        pendingBrowserOpen: { forwardId: "test-id", localPort: 8080 },
      });

      act(() => {
        usePortForwardStore.getState().confirmOpenBrowser(false);
      });

      expect(openUrl).toHaveBeenCalledWith("http://localhost:8080");
      expect(usePortForwardStore.getState().pendingBrowserOpen).toBeNull();
    });

    it("dismissBrowserDialog should clear pending without opening", () => {
      usePortForwardStore.setState({
        pendingBrowserOpen: { forwardId: "test-id", localPort: 8080 },
      });

      act(() => {
        usePortForwardStore.getState().dismissBrowserDialog(false);
      });

      expect(openUrl).not.toHaveBeenCalled();
      expect(usePortForwardStore.getState().pendingBrowserOpen).toBeNull();
    });
  });

  describe("setupListener", () => {
    it("should not setup duplicate listeners", async () => {
      await act(async () => {
        await usePortForwardStore.getState().setupListener("test-id");
      });
      await act(async () => {
        await usePortForwardStore.getState().setupListener("test-id");
      });

      // listen should only be called once for same id
      expect(listen).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopAllForwards", () => {
    it("should stop all active forwards", async () => {
      mockPortforwardStop.mockResolvedValue(undefined);
      const forward2 = { ...mockForward, forward_id: "id-2", name: "svc-2" };
      usePortForwardStore.setState({ forwards: [{ ...mockForward }, forward2] });

      await act(async () => {
        await usePortForwardStore.getState().stopAllForwards();
      });

      expect(mockPortforwardStop).toHaveBeenCalledTimes(2);
      expect(mockPortforwardStop).toHaveBeenCalledWith(mockForward.forward_id);
      expect(mockPortforwardStop).toHaveBeenCalledWith("id-2");
    });
  });

  describe("forward dialog", () => {
    it("requestForward sets pendingForwardRequest correctly", () => {
      act(() => {
        usePortForwardStore.getState().requestForward("default", "my-svc", "service", 8080);
      });

      const pending = usePortForwardStore.getState().pendingForwardRequest;
      expect(pending).toEqual({
        namespace: "default",
        name: "my-svc",
        targetType: "service",
        targetPort: 8080,
      });
    });

    it("confirmForward with custom port calls startForward with correct args and clears pending", async () => {
      mockPortforwardStart.mockResolvedValue({ ...mockForward, local_port: 9090 });

      // Set pending request
      act(() => {
        usePortForwardStore.getState().requestForward("default", "test-svc", "service", 8080);
      });

      expect(usePortForwardStore.getState().pendingForwardRequest).not.toBeNull();

      await act(async () => {
        const result = await usePortForwardStore.getState().confirmForward(9090);
        expect(result).not.toBeNull();
      });

      // Pending should be cleared
      expect(usePortForwardStore.getState().pendingForwardRequest).toBeNull();

      // startForward should have been called with the custom port
      expect(mockPortforwardStart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          namespace: "default",
          name: "test-svc",
          target_type: "service",
          target_port: 8080,
          local_port: 9090,
        })
      );
    });

    it("confirmForward without port calls startForward with localPort undefined", async () => {
      mockPortforwardStart.mockResolvedValue({ ...mockForward });

      act(() => {
        usePortForwardStore.getState().requestForward("default", "test-svc", "service", 8080);
      });

      await act(async () => {
        await usePortForwardStore.getState().confirmForward();
      });

      expect(mockPortforwardStart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          namespace: "default",
          name: "test-svc",
          target_type: "service",
          target_port: 8080,
          local_port: undefined,
        })
      );
    });

    it("confirmForward returns null if no pending request", async () => {
      let result: unknown;
      await act(async () => {
        result = await usePortForwardStore.getState().confirmForward(9090);
      });

      expect(result).toBeNull();
      expect(mockPortforwardStart).not.toHaveBeenCalled();
    });

    it("confirmForward keeps pendingForwardRequest when startForward fails", async () => {
      mockPortforwardStart.mockRejectedValue(new Error("Port in use"));

      act(() => {
        usePortForwardStore.getState().requestForward("default", "test-svc", "service", 8080);
      });

      expect(usePortForwardStore.getState().pendingForwardRequest).not.toBeNull();

      await act(async () => {
        const result = await usePortForwardStore.getState().confirmForward(9090);
        expect(result).toBeNull();
      });

      // Pending should NOT be cleared so dialog stays open for retry
      expect(usePortForwardStore.getState().pendingForwardRequest).not.toBeNull();
    });

    it("portName propagates through requestForward -> confirmForward -> forward's port_name", async () => {
      mockPortforwardStart.mockResolvedValue({ ...mockForward, target_port: 5672, local_port: 9090 });

      act(() => {
        usePortForwardStore.getState().requestForward("default", "test-svc", "service", 5672, "amqp");
      });

      const pending = usePortForwardStore.getState().pendingForwardRequest;
      expect(pending?.portName).toBe("amqp");

      await act(async () => {
        await usePortForwardStore.getState().confirmForward();
      });

      const forwards = usePortForwardStore.getState().forwards;
      const forward = forwards[forwards.length - 1];
      expect(forward?.port_name).toBe("amqp");
      expect(forward?.requested_port).toBe(5672);
    });

    it("dismissForwardDialog clears pendingForwardRequest", () => {
      act(() => {
        usePortForwardStore.getState().requestForward("default", "my-svc", "service", 8080);
      });

      expect(usePortForwardStore.getState().pendingForwardRequest).not.toBeNull();

      act(() => {
        usePortForwardStore.getState().dismissForwardDialog();
      });

      expect(usePortForwardStore.getState().pendingForwardRequest).toBeNull();
    });
  });

  describe("history actions", () => {
    describe("recordHistoryStarted", () => {
      it("should add a history entry with current cluster context", () => {
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted(mockForward);
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].cluster_context).toBe("test-cluster");
        expect(history[0].namespace).toBe("default");
        expect(history[0].name).toBe("test-svc");
        expect(history[0].status).toBe("active");
        expect(history[0].forward_id).toBe(mockForward.forward_id);
        expect(history[0].started_at).toBeGreaterThan(0);
      });

      // History follows the forward's own cluster_context, not the active
      // cluster: a switch landing while the start is in flight must not file
      // the entry under the wrong cluster (or drop it when nothing is active).
      it("should record against the forward's cluster even with no active cluster", () => {
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted(mockForward);
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].cluster_context).toBe(mockForward.cluster_context);
      });

      it("should file history under the forward's cluster, not the active one", () => {
        // The active cluster mock stays "test-cluster"; this forward belongs
        // to another one and must be filed there, not under the active one.
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted({
            ...mockForward,
            cluster_context: "survivor-cluster",
          });
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].cluster_context).toBe("survivor-cluster");
      });

      it("should upsert by signature — a second call for the same logical forward updates the row", () => {
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted(mockForward);
          usePortForwardStore.getState().recordHistoryStarted({
            ...mockForward,
            forward_id: "new-run-id",
          });
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].forward_id).toBe("new-run-id");
      });

      it("should preserve original started_at when restarting a port forward", () => {
        // First call: record initial start
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted(mockForward);
        });

        const history1 = usePortForwardStore.getState().history;
        const initialStartedAt = history1[0].started_at;

        // Simulate waiting
        const initialUpdatedAt = history1[0].updated_at;

        // Mock time passing - in reality this would be seconds or minutes
        // Second call: simulate restarting the same forward
        act(() => {
          usePortForwardStore.getState().recordHistoryStarted({
            ...mockForward,
            forward_id: "restarted-run-id",
          });
        });

        const history2 = usePortForwardStore.getState().history;
        expect(history2).toHaveLength(1);

        // Key assertion: started_at should be preserved from the original start
        expect(history2[0].started_at).toBe(initialStartedAt);

        // But updated_at should reflect the restart
        expect(history2[0].updated_at).toBeGreaterThanOrEqual(initialUpdatedAt);

        // forward_id should be updated to the new run
        expect(history2[0].forward_id).toBe("restarted-run-id");
      });
    });

    describe("markHistoryInactive", () => {
      it("should set status inactive and store stop reason and stopped_at", () => {
        usePortForwardStore.setState({
          history: [{ ...mockHistoryItem, status: "active" }],
        });

        act(() => {
          usePortForwardStore.getState().markHistoryInactive(mockForward.forward_id, "user");
        });

        const item = usePortForwardStore.getState().history[0];
        expect(item.status).toBe("inactive");
        expect(item.stop_reason).toBe("user");
        expect(item.stopped_at).toBeDefined();
      });
    });

    describe("markHistoryError", () => {
      it("should set status error, stop_reason error, and store error_message", () => {
        usePortForwardStore.setState({
          history: [{ ...mockHistoryItem, status: "active" }],
        });

        act(() => {
          usePortForwardStore
            .getState()
            .markHistoryError(mockForward.forward_id, "Connection refused");
        });

        const item = usePortForwardStore.getState().history[0];
        expect(item.status).toBe("error");
        expect(item.stop_reason).toBe("error");
        expect(item.error_message).toBe("Connection refused");
        expect(item.stopped_at).toBeDefined();
      });
    });

    describe("removeHistoryItem", () => {
      it("should remove only the item matching the given id", () => {
        const other = { ...mockHistoryItem, id: "hist-2", signature: "sig-2" };
        usePortForwardStore.setState({ history: [{ ...mockHistoryItem }, other] });

        act(() => {
          usePortForwardStore.getState().removeHistoryItem("hist-test-1");
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].id).toBe("hist-2");
      });
    });

    describe("clearHistoryForCurrentCluster", () => {
      it("should remove entries for the current cluster only, leaving other clusters intact", () => {
        const otherClusterItem = {
          ...mockHistoryItem,
          id: "hist-other",
          cluster_context: "other-cluster",
          signature: "other-cluster|default|service|test-svc|8080",
        };
        usePortForwardStore.setState({
          history: [{ ...mockHistoryItem }, otherClusterItem],
        });

        act(() => {
          usePortForwardStore.getState().clearHistoryForCurrentCluster();
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].cluster_context).toBe("other-cluster");
      });

      it("should not touch the active forwards array", () => {
        const liveForward: PortForwardInfo = {
          ...mockForward,
          forward_id: "live-1",
        };
        usePortForwardStore.setState({
          history: [{ ...mockHistoryItem }],
          forwards: [liveForward],
        });

        act(() => {
          usePortForwardStore.getState().clearHistoryForCurrentCluster();
        });

        const state = usePortForwardStore.getState();
        expect(state.history).toHaveLength(0);
        expect(state.forwards).toEqual([liveForward]);
      });
    });

    describe("restartFromHistory", () => {
      it("should call startForward with saved values and reuse local port when available", async () => {
        mockPortforwardStart.mockResolvedValue({ ...mockForward, local_port: 41587 });
        mockPortforwardCheckPort.mockResolvedValue(true);

        await act(async () => {
          await usePortForwardStore.getState().restartFromHistory(mockHistoryItem);
        });

        expect(mockPortforwardCheckPort).toHaveBeenCalledWith(41587);
        expect(mockPortforwardStart).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            namespace: "default",
            name: "test-svc",
            target_type: "service",
            target_port: 8080,
            local_port: 41587,
          })
        );
      });

      // Regression: a history entry outlives the connection it was made on.
      // Without pinning its cluster, the backend would bind the restart to
      // whichever cluster is active - silently, when that cluster happens to
      // have a service with the same namespace/name.
      it("should pin the restart to the history entry's own cluster", async () => {
        mockPortforwardStart.mockResolvedValue({ ...mockForward, local_port: 41587 });
        mockPortforwardCheckPort.mockResolvedValue(true);

        await act(async () => {
          await usePortForwardStore.getState().restartFromHistory({
            ...mockHistoryItem,
            cluster_context: "survivor-cluster",
          });
        });

        expect(mockPortforwardStart).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ expected_context: "survivor-cluster" })
        );
      });

      it("should fall back to auto port selection when saved local port is unavailable", async () => {
        mockPortforwardStart.mockResolvedValue({ ...mockForward, local_port: 55000 });
        mockPortforwardCheckPort.mockResolvedValue(false);

        await act(async () => {
          await usePortForwardStore.getState().restartFromHistory(mockHistoryItem);
        });

        expect(mockPortforwardStart).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ local_port: undefined })
        );
      });

      it("should update history with the new forward_id before backend start resolves", async () => {
        usePortForwardStore.setState({
          history: [{ ...mockHistoryItem, status: "inactive", stop_reason: "user" }],
        });
        mockPortforwardCheckPort.mockResolvedValue(true);

        let capturedForwardId = "";
        let resolveStart: (value: PortForwardInfo) => void = () => {};
        mockPortforwardStart.mockImplementation((forwardId: string) => {
          capturedForwardId = forwardId;
          return new Promise<PortForwardInfo>((resolve) => {
            resolveStart = resolve;
          });
        });

        let restartPromise!: Promise<PortForwardInfo | null>;
        await act(async () => {
          restartPromise = usePortForwardStore.getState().restartFromHistory(mockHistoryItem);
          await Promise.resolve();
        });

        const stateDuringRestart = usePortForwardStore.getState();
        expect(capturedForwardId).not.toBe("");
        expect(stateDuringRestart.history[0].forward_id).toBe(capturedForwardId);
        expect(stateDuringRestart.history[0].status).toBe("active");
        expect(stateDuringRestart.history[0].stop_reason).toBeUndefined();
        expect(stateDuringRestart.forwards[0].forward_id).toBe(capturedForwardId);

        await act(async () => {
          resolveStart({ ...mockForward, local_port: 41587 });
          await restartPromise;
        });
      });

      it("should roll back the pre-updated history row when restart fails", async () => {
        usePortForwardStore.setState({
          history: [
            {
              ...mockHistoryItem,
              status: "inactive",
              stop_reason: "user",
              stopped_at: 12345,
            },
          ],
        });
        mockPortforwardCheckPort.mockResolvedValue(true);
        mockPortforwardStart.mockRejectedValue(new Error("Port in use"));

        await act(async () => {
          await usePortForwardStore.getState().restartFromHistory(mockHistoryItem);
        });

        const history = usePortForwardStore.getState().history;
        expect(history[0].forward_id).toBe(mockHistoryItem.forward_id);
        expect(history[0].status).toBe("inactive");
        expect(history[0].stop_reason).toBe("user");
        expect(history[0].stopped_at).toBe(12345);
      });
    });

    describe("startForward records history", () => {
      it("should add a history entry with both requested_port and resolved target_port", async () => {
        mockPortforwardStart.mockResolvedValue({
          ...mockForward,
          target_port: 3000,
          local_port: 55555,
        });

        await act(async () => {
          await usePortForwardStore
            .getState()
            .startForward("default", "test-svc", "service", 8080, undefined, "http");
        });

        const history = usePortForwardStore.getState().history;
        expect(history).toHaveLength(1);
        expect(history[0].requested_port).toBe(8080);
        expect(history[0].target_port).toBe(3000);
        expect(history[0].port_name).toBe("http");
        expect(history[0].status).toBe("active");
      });
    });
  });

  describe("event handling - history", () => {
    beforeEach(async () => {
      usePortForwardStore.setState({
        ...defaultState,
        forwards: [{ ...mockForward }],
        history: [{ ...mockHistoryItem, status: "active" }],
      });
      await act(async () => {
        await usePortForwardStore.getState().setupListener(mockForward.forward_id);
      });
    });

    it("Stopped marks history inactive with stop_reason user and removes active forward", () => {
      act(() => {
        simulateEvent({
          type: "Stopped",
          data: { forward_id: mockForward.forward_id },
        } as PortForwardEvent);
      });

      const state = usePortForwardStore.getState();
      expect(state.forwards).toHaveLength(0);
      expect(state.history[0].status).toBe("inactive");
      expect(state.history[0].stop_reason).toBe("user");
      expect(state.history[0].stopped_at).toBeDefined();
    });

    it("PodDied marks history inactive with stop_reason podDied", () => {
      act(() => {
        simulateEvent({
          type: "PodDied",
          data: { forward_id: mockForward.forward_id, pod_name: "test-pod-abc" },
        } as PortForwardEvent);
      });

      const history = usePortForwardStore.getState().history;
      expect(history[0].status).toBe("inactive");
      expect(history[0].stop_reason).toBe("podDied");
      expect(history[0].stopped_at).toBeDefined();
    });

    it("Error marks history status error with error_message", () => {
      act(() => {
        simulateEvent({
          type: "Error",
          data: { forward_id: mockForward.forward_id, message: "Connection refused" },
        } as PortForwardEvent);
      });

      const history = usePortForwardStore.getState().history;
      expect(history[0].status).toBe("error");
      expect(history[0].error_message).toBe("Connection refused");
    });

    it("Reconnected updates history pod_name without duplicating the row", () => {
      act(() => {
        simulateEvent({
          type: "Reconnected",
          data: { forward_id: mockForward.forward_id, new_pod: "test-pod-xyz" },
        } as PortForwardEvent);
      });

      const history = usePortForwardStore.getState().history;
      expect(history).toHaveLength(1);
      expect(history[0].pod_name).toBe("test-pod-xyz");
    });

    it("Connected clears stopped_at, error_message and sets status active", () => {
      usePortForwardStore.setState({
        history: [
          {
            ...mockHistoryItem,
            status: "inactive",
            stopped_at: 999999,
            error_message: "old error",
          },
        ],
      });

      act(() => {
        simulateEvent({
          type: "Connected",
          data: { forward_id: mockForward.forward_id },
        } as PortForwardEvent);
      });

      const history = usePortForwardStore.getState().history;
      expect(history[0].status).toBe("active");
      expect(history[0].stopped_at).toBeUndefined();
      expect(history[0].error_message).toBeUndefined();
    });
  });
});
