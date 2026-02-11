import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import {
  portforwardStart,
  portforwardStop,
  portforwardList,
  portforwardCheckPort,
} from "@/lib/tauri/commands";
import { useUIStore } from "@/lib/stores/ui-store";
import type {
  PortForwardInfo,
  PortForwardEvent,
  PortForwardTargetType,
  PortForwardStatus,
} from "@/lib/types";

interface PendingBrowserOpen {
  forwardId: string;
  localPort: number;
}

interface PortForwardState {
  forwards: PortForwardInfo[];
  isLoading: boolean;
  error: string | null;
  listeners: Map<string, UnlistenFn>;
  initialized: boolean;

  // Browser dialog state
  pendingBrowserOpen: PendingBrowserOpen | null;

  // Actions
  initialize: () => Promise<void>;
  refreshForwards: () => Promise<void>;
  startForward: (
    namespace: string,
    name: string,
    targetType: PortForwardTargetType,
    targetPort: number,
    localPort?: number
  ) => Promise<PortForwardInfo | null>;
  stopForward: (forwardId: string) => Promise<void>;
  stopAllForwards: () => Promise<void>;
  checkPort: (port: number) => Promise<boolean>;
  getForward: (forwardId: string) => PortForwardInfo | undefined;

  // Browser dialog actions
  confirmOpenBrowser: (rememberChoice: boolean) => void;
  dismissBrowserDialog: (rememberChoice: boolean) => void;

  // Internal
  setupListener: (forwardId: string) => Promise<void>;
  updateForwardStatus: (forwardId: string, status: PortForwardStatus) => void;
  removeForward: (forwardId: string) => void;
  setError: (error: string | null) => void;
  cleanup: () => void;
}

export const usePortForwardStore = create<PortForwardState>((set, get) => ({
  forwards: [],
  isLoading: false,
  error: null,
  listeners: new Map(),
  initialized: false,
  pendingBrowserOpen: null,

  initialize: async () => {
    // Only initialize once
    if (get().initialized) {
      return;
    }
    set({ initialized: true });
    await get().refreshForwards();
  },

  refreshForwards: async () => {
    try {
      const forwards = await portforwardList();
      set({ forwards });

      // Setup listeners for any forwards we don't have listeners for
      for (const forward of forwards) {
        if (!get().listeners.has(forward.forward_id)) {
          await get().setupListener(forward.forward_id);
        }
      }
    } catch (err) {
      console.error("Failed to refresh port forwards:", err);
    }
  },

  setupListener: async (forwardId: string) => {
    const { listeners } = get();

    // Don't setup duplicate listeners
    if (listeners.has(forwardId)) {
      return;
    }

    const eventName = `portforward-${forwardId}`;

    try {
      const unlisten = await listen<PortForwardEvent>(eventName, (event) => {
        const payload = event.payload;

        switch (payload.type) {
          case "Started":
            // Update status and local_port from the event
            set((state) => ({
              forwards: state.forwards.map((f) =>
                f.forward_id === payload.data.forward_id
                  ? { ...f, status: "connecting" as const, local_port: payload.data.local_port }
                  : f
              ),
            }));
            break;

          case "Connected": {
            get().updateForwardStatus(payload.data.forward_id, "connected");
            const forward = get().forwards.find(
              (f) => f.forward_id === payload.data.forward_id
            );
            if (forward) {
              toast.success("Port forward connected", {
                description: `localhost:${forward.local_port} -> ${forward.name}:${forward.target_port}`,
              });

              // Check browser open preference
              const browserBehavior = useUIStore.getState().settings.portForwardOpenBrowser;

              if (browserBehavior === "always") {
                // Auto-open in browser
                openUrl(`http://localhost:${forward.local_port}`).catch((err) => {
                  console.error("Failed to open browser:", err);
                });
              } else if (browserBehavior === "ask") {
                // Show dialog to ask user
                set({
                  pendingBrowserOpen: {
                    forwardId: forward.forward_id,
                    localPort: forward.local_port,
                  },
                });
              }
              // If "never", do nothing
            }
            break;
          }

          case "Reconnecting":
            get().updateForwardStatus(payload.data.forward_id, "reconnecting");
            toast.info("Port forward reconnecting", {
              description: payload.data.reason,
            });
            break;

          case "Reconnected": {
            get().updateForwardStatus(payload.data.forward_id, "connected");
            // Update pod_name on the forward
            set((state) => ({
              forwards: state.forwards.map((f) =>
                f.forward_id === payload.data.forward_id
                  ? { ...f, status: "connected" as const, pod_name: payload.data.new_pod }
                  : f
              ),
            }));
            toast.success("Port forward reconnected", {
              description: `Connected to new pod: ${payload.data.new_pod}`,
            });
            break;
          }

          case "PodDied": {
            get().updateForwardStatus(payload.data.forward_id, "disconnected");
            toast.warning("Port forward lost", {
              description: `Pod ${payload.data.pod_name} was removed. No replacement found.`,
            });
            break;
          }

          case "Disconnected":
            get().updateForwardStatus(payload.data.forward_id, "disconnected");
            toast.info("Port forward disconnected");
            break;

          case "Error":
            get().updateForwardStatus(payload.data.forward_id, "error");
            get().setError(payload.data.message);
            toast.error("Port forward error", {
              description: payload.data.message,
            });
            break;

          case "Stopped": {
            // Remove listener
            const storedUnlisten = get().listeners.get(payload.data.forward_id);
            if (storedUnlisten) {
              storedUnlisten();
              const newListeners = new Map(get().listeners);
              newListeners.delete(payload.data.forward_id);
              set({ listeners: newListeners });
            }
            get().removeForward(payload.data.forward_id);
            break;
          }
        }
      });

      const newListeners = new Map(listeners);
      newListeners.set(forwardId, unlisten);
      set({ listeners: newListeners });
    } catch (err) {
      console.error(`Failed to setup listener for ${forwardId}:`, err);
    }
  },

  startForward: async (namespace, name, targetType, targetPort, localPort) => {
    set({ isLoading: true, error: null });

    try {
      const forwardId = `${targetType}-${namespace}-${name}-${targetPort}-${Date.now()}`;

      // Add placeholder forward BEFORE calling Rust to avoid race condition
      // The "Connected" event might arrive before portforwardStart returns
      const placeholderForward: PortForwardInfo = {
        forward_id: forwardId,
        namespace,
        name,
        target_type: targetType,
        target_port: targetPort,
        local_port: localPort ?? 0, // Will be updated when we get the response
        status: "connecting",
        pod_name: undefined,
        pod_uid: undefined,
      };

      set((state) => ({
        forwards: [...state.forwards, placeholderForward],
      }));

      // Setup listener before starting
      await get().setupListener(forwardId);

      const info = await portforwardStart(forwardId, {
        namespace,
        name,
        target_type: targetType,
        target_port: targetPort,
        local_port: localPort,
      });

      // Update with actual info (especially local_port if it was auto-assigned)
      set((state) => ({
        isLoading: false,
        forwards: state.forwards.map((f) =>
          f.forward_id === forwardId
            ? { ...f, local_port: info.local_port }
            : f
        ),
      }));

      return info;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start port forward";
      // Remove the placeholder on error
      const forwardId = `${targetType}-${namespace}-${name}-${targetPort}`;
      set((state) => ({
        isLoading: false,
        error: errorMessage,
        forwards: state.forwards.filter(
          (f) => !f.forward_id.startsWith(forwardId)
        ),
      }));
      return null;
    }
  },

  stopForward: async (forwardId: string) => {
    try {
      await portforwardStop(forwardId);
    } catch (err) {
      console.error("Failed to stop port forward:", err);
      set({
        error: err instanceof Error ? err.message : "Failed to stop port forward",
      });
    }
  },

  stopAllForwards: async () => {
    const { forwards, stopForward } = get();
    await Promise.all(forwards.map((f) => stopForward(f.forward_id)));
  },

  checkPort: async (port: number): Promise<boolean> => {
    try {
      return await portforwardCheckPort(port);
    } catch (err) {
      console.error("Failed to check port:", err);
      return false;
    }
  },

  getForward: (forwardId: string) => {
    return get().forwards.find((f) => f.forward_id === forwardId);
  },

  updateForwardStatus: (forwardId: string, status: PortForwardStatus) => {
    set((state) => ({
      forwards: state.forwards.map((f) =>
        f.forward_id === forwardId ? { ...f, status } : f
      ),
    }));
  },

  removeForward: (forwardId: string) => {
    set((state) => ({
      forwards: state.forwards.filter((f) => f.forward_id !== forwardId),
    }));
  },

  setError: (error: string | null) => {
    set({ error });
  },

  confirmOpenBrowser: (rememberChoice: boolean) => {
    const { pendingBrowserOpen } = get();
    if (pendingBrowserOpen) {
      // Open browser
      openUrl(`http://localhost:${pendingBrowserOpen.localPort}`).catch((err) => {
        console.error("Failed to open browser:", err);
      });

      // Save preference if user wants to remember
      if (rememberChoice) {
        useUIStore.getState().updateSettings({ portForwardOpenBrowser: "always" });
      }

      // Clear pending state
      set({ pendingBrowserOpen: null });
    }
  },

  dismissBrowserDialog: (rememberChoice: boolean) => {
    // Save preference if user wants to remember
    if (rememberChoice) {
      useUIStore.getState().updateSettings({ portForwardOpenBrowser: "never" });
    }

    // Clear pending state
    set({ pendingBrowserOpen: null });
  },

  cleanup: () => {
    const { listeners } = get();
    listeners.forEach((unlisten) => unlisten());
    set({ listeners: new Map(), forwards: [] });
  },
}));
