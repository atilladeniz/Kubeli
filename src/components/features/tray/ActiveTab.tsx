import { ExternalLink, Square, Loader2 } from "lucide-react";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useState } from "react";

export function ActiveTab() {
  const forwards = usePortForwardStore((s) => s.forwards);
  const stopForward = usePortForwardStore((s) => s.stopForward);
  const stopAllForwards = usePortForwardStore((s) => s.stopAllForwards);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [stoppingAll, setStoppingAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleStop = async (forwardId: string) => {
    setStoppingId(forwardId);
    try {
      await stopForward(forwardId);
    } finally {
      setStoppingId(null);
    }
  };

  const handleStopAll = async () => {
    setStoppingAll(true);
    try {
      await stopAllForwards();
    } finally {
      setStoppingAll(false);
    }
  };

  const handleOpenBrowser = async (localPort: number) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${localPort}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
    }
  };

  const handleCopy = async (forwardId: string, localPort: number) => {
    try {
      await navigator.clipboard.writeText(`localhost:${localPort}`);
      setCopiedId(forwardId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard API may not be available
    }
  };

  const statusDot = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "reconnecting":
      case "connecting":
        return "bg-yellow-500 animate-pulse";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  if (forwards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground/60 px-6 text-center leading-relaxed">
        No active port forwards.
        <br />
        Use the Forward tab to start one.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Forward List */}
      <div className="flex-1 overflow-y-auto overscroll-none px-3">
        {forwards.map((forward) => (
          <div
            key={forward.forward_id}
            className="flex items-center gap-2 px-1.5 py-2 rounded-md hover:bg-muted/40 group transition-colors cursor-pointer"
            onClick={() => handleCopy(forward.forward_id, forward.local_port)}
            title="Click to copy localhost address"
          >
            {/* Status dot */}
            <div
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(forward.status)}`}
            />

            {/* Info */}
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-foreground truncate leading-tight">
                {forward.name}
                {copiedId === forward.forward_id && (
                  <span className="ml-1.5 text-[9px] text-green-500">Copied!</span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5">
                localhost:{forward.local_port} &rarr; :{forward.target_port}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenBrowser(forward.local_port);
                }}
                className="p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Open in browser"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStop(forward.forward_id);
                }}
                disabled={stoppingId === forward.forward_id}
                className="p-1 rounded-md text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Stop forward"
              >
                {stoppingId === forward.forward_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Square className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Stop All */}
      {forwards.length > 1 && (
        <div className="px-3 pb-3 pt-1.5 shrink-0">
          <button
            onClick={handleStopAll}
            disabled={stoppingAll}
            className="w-full py-1.5 text-[11px] font-medium rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {stoppingAll ? "Stopping..." : "Stop All"}
          </button>
        </div>
      )}
    </div>
  );
}
