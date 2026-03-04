import { useCallback, useEffect, useState } from "react";
import { TrayPopup } from "./TrayPopup";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { getConnectionStatus } from "@/lib/tauri/commands/cluster";

export function TrayApp() {
  const [isReady, setIsReady] = useState(false);
  const initialize = usePortForwardStore((s) => s.initialize);
  const fetchClusters = useClusterStore((s) => s.fetchClusters);
  const fetchNamespaces = useClusterStore((s) => s.fetchNamespaces);

  // Sync cluster state with backend (shared with main window)
  const syncClusterState = useCallback(async () => {
    await fetchClusters();
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
  }, [fetchClusters, fetchNamespaces]);

  // Initial setup
  useEffect(() => {
    const init = async () => {
      await syncClusterState();
      await initialize();
      setIsReady(true);
    };
    init();
  }, [syncClusterState, initialize]);

  // Re-sync every time the tray window becomes visible (focus event)
  useEffect(() => {
    const handleFocus = () => {
      syncClusterState();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [syncClusterState]);

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
      <div className="h-[480px] w-[360px] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-muted-foreground text-xs">Loading...</div>
      </div>
    );
  }

  return <TrayPopup />;
}
