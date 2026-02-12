import { act } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { usePortForwardStore, getReconnectStartTime } from "../portforward-store";
import type { PortForwardInfo, PortForwardEvent } from "@/lib/types";

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
  namespace: "default",
  name: "test-svc",
  target_type: "service",
  target_port: 8080,
  local_port: 41587,
  status: "connected",
  pod_name: "test-pod-abc",
  pod_uid: "uid-123",
};

const defaultState = {
  forwards: [],
  isLoading: false,
  error: null,
  listeners: new Map(),
  initialized: false,
  pendingBrowserOpen: null,
};

describe("PortForwardStore", () => {
  beforeEach(() => {
    usePortForwardStore.setState(defaultState);
    listenCallback = null;
    jest.clearAllMocks();
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
});
