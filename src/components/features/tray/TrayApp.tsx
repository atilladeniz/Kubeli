import { useCallback, useEffect, useRef, useState } from "react";
import { TrayPopup } from "./TrayPopup";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { getConnectionStatus } from "@/lib/tauri/commands/cluster";

export function TrayApp() {
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);
  const initialize = usePortForwardStore((s) => s.initialize);
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const fetchNamespaces = useClusterStore((s) => s.fetchNamespaces);

  // Lightweight sync: only check connection status, don't re-fetch clusters
  const syncConnectionState = useCallback(async () => {
    const status = await getConnectionStatus();
    const clusters = useClusterStore.getState().clusters;

    if (status.connected && status.context) {
      const connectedCluster =
        clusters.find((c) => c.context === status.context) || null;
      useClusterStore.setState({
        isConnected: true,
        currentCluster: connectedCluster,
      });
      await fetchNamespaces();
    } else {
      useClusterStore.setState({
        isConnected: false,
        currentCluster: null,
      });
    }
  }, [fetchNamespaces]);

  // Initial setup (runs once)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      await fetchClusters();
      await syncConnectionState();
      await initialize();
      setIsReady(true);
    };
    init();
  }, [fetchClusters, syncConnectionState, initialize]);

  // Re-sync every time the tray popup is shown (event from Rust backend)
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("tray-popup-shown", () => {
        syncConnectionState();
      }).then((fn) => {
        unlisten = fn;
      });
    });
    return () => {
      unlisten?.();
    };
  }, [syncConnectionState]);

  // Prevent context menu in tray popup
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, []);

  // Auto-dismiss when window loses focus (click outside on macOS desktop)
  useEffect(() => {
    const handleBlur = async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        // Small delay to avoid race with tray icon toggle
        setTimeout(async () => {
          if (!document.hasFocus()) {
            await win.hide();
          }
        }, 100);
      } catch {
        // Not in Tauri environment
      }
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  if (!isReady) {
    return (
      <div className="h-[480px] w-[360px] flex items-center justify-center bg-background/80 backdrop-blur-xl">
        <div className="text-muted-foreground text-xs">Loading...</div>
      </div>
    );
  }

  return <TrayPopup />;
}
