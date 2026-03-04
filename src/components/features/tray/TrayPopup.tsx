import { useState, useEffect } from "react";
import { ExternalLink, Power, ChevronDown, Loader2, Circle } from "lucide-react";
import { ForwardTab } from "./ForwardTab";
import { ActiveTab } from "./ActiveTab";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";

type TabId = "forward" | "active";

export function TrayPopup() {
  const [activeTab, setActiveTab] = useState<TabId>("forward");
  const [clusterOpen, setClusterOpen] = useState(false);

  // Close dropdown when tray loses focus / gets dismissed
  useEffect(() => {
    const handleBlur = () => setClusterOpen(false);
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);
  const [connecting, setConnecting] = useState(false);
  const activeCount = usePortForwardStore((s) => s.forwards.length);
  const clusters = useClusterStore((s) => s.clusters);
  const currentCluster = useClusterStore((s) => s.currentCluster);
  const isConnected = useClusterStore((s) => s.isConnected);
  const connect = useClusterStore((s) => s.connect);
  const fetchNamespaces = useClusterStore((s) => s.fetchNamespaces);

  const openMainWindow = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("show_main_window_command");
    } catch (err) {
      console.error("Failed to open main window:", err);
    }
  };

  const quitApp = async () => {
    try {
      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch (err) {
      console.error("Failed to quit:", err);
    }
  };

  const handleSwitchCluster = async (context: string) => {
    setClusterOpen(false);
    if (currentCluster?.context === context && isConnected) return;
    setConnecting(true);
    try {
      await connect(context);
      await fetchNamespaces();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="h-[480px] w-[360px] flex flex-col overflow-hidden bg-background/80 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0">
        {/* Cluster selector */}
        <div className="relative min-w-0 flex-1 mr-2">
          <button
            onClick={() => setClusterOpen(!clusterOpen)}
            className="flex items-center gap-1.5 min-w-0 max-w-full px-1.5 py-1 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <Circle
              className={`h-2 w-2 shrink-0 ${isConnected ? "fill-green-500 text-green-500" : "fill-muted-foreground/30 text-muted-foreground/30"}`}
            />
            <span className="text-[13px] font-semibold text-foreground truncate">
              {connecting
                ? "Connecting..."
                : currentCluster
                  ? currentCluster.name
                  : "Cluster wählen"}
            </span>
            <ChevronDown className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform ${clusterOpen ? "rotate-180" : ""}`} />
          </button>

          {clusterOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setClusterOpen(false)} />
              <div
                className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg shadow-xl max-h-48 overflow-y-auto overscroll-none border border-white/[0.1]"
                style={{ backgroundColor: "#2a2a2a" }}
              >
                {clusters.map((cluster) => {
                  const isCurrent = currentCluster?.context === cluster.context && isConnected;
                  return (
                    <button
                      key={cluster.context}
                      onClick={() => handleSwitchCluster(cluster.context)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-[11px] transition-colors hover:brightness-125 first:rounded-t-lg last:rounded-b-lg ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}
                      style={{ backgroundColor: isCurrent ? "#333" : "transparent" }}
                    >
                      <Circle
                        className={`h-1.5 w-1.5 shrink-0 ${isCurrent ? "fill-green-500 text-green-500" : "fill-transparent text-muted-foreground/30"}`}
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium">{cluster.name}</div>
                        {cluster.name !== cluster.context && (
                          <div className="truncate text-[10px] text-muted-foreground/50">{cluster.context}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {clusters.length === 0 && (
                  <div className="px-2.5 py-2 text-[11px] text-muted-foreground/50">
                    No clusters found
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {connecting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mr-1" />}
          <button
            onClick={openMainWindow}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            title="Open Kubeli"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={quitApp}
            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Quit Kubeli"
          >
            <Power className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="px-3 pb-2 shrink-0">
        <div className="flex bg-white/[0.04] rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab("forward")}
            className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              activeTab === "forward"
                ? "bg-white/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Forward
          </button>
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all ${
              activeTab === "active"
                ? "bg-white/[0.08] text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Active{activeCount > 0 ? ` (${activeCount})` : ""}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {!isConnected && !connecting ? (
          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground/60 px-6 text-center leading-relaxed">
            Select a cluster to get started.
          </div>
        ) : activeTab === "forward" ? (
          <ForwardTab />
        ) : (
          <ActiveTab />
        )}
      </div>
    </div>
  );
}
