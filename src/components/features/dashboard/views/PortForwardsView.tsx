"use client";

import { useState } from "react";
import { ArrowRightLeft, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { usePortForward } from "@/lib/hooks/usePortForward";

export function PortForwardsView() {
  const { forwards, stopForward } = usePortForward();
  const [stopDialog, setStopDialog] = useState<{ forwardId: string; name: string } | null>(null);

  const handleOpenInBrowser = async (port: number) => {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(`http://localhost:${port}`);
    } catch (err) {
      console.error("Failed to open browser:", err);
      window.open(`http://localhost:${port}`, "_blank");
    }
  };

  const handleStop = (forwardId: string, name: string) => {
    setStopDialog({ forwardId, name });
  };

  const confirmStop = () => {
    if (stopDialog) {
      stopForward(stopDialog.forwardId);
      setStopDialog(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-400";
      case "connecting":
        return "bg-yellow-400 animate-pulse";
      case "reconnecting":
        return "bg-orange-400 animate-pulse";
      case "error":
        return "bg-red-400";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Error";
      case "disconnected":
        return "Disconnected";
      default:
        return status;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Port Forwards</h1>
          <Badge variant="secondary">{forwards.length}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {forwards.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <ArrowRightLeft className="size-12 stroke-1" />
            <div className="text-center">
              <p className="font-medium">No active port forwards</p>
              <p className="text-sm">Start a port forward from Services or Pods view</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {forwards.map((forward) => (
              <div
                key={forward.forward_id}
                className="rounded-lg border border-border bg-card p-3 space-y-2 overflow-hidden"
              >
                {/* Row 1: Status + Type + Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-2 rounded-full shrink-0", getStatusColor(forward.status))} />
                    <span className="text-xs font-medium shrink-0">{getStatusText(forward.status)}</span>
                    <Badge variant="outline" className="capitalize text-[10px] shrink-0">
                      {forward.target_type}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenInBrowser(forward.local_port)}
                      disabled={forward.status !== "connected"}
                    >
                      <ExternalLink className="size-4" />
                      Open
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleStop(forward.forward_id, forward.name)}
                    >
                      <X className="size-4" />
                      Stop
                    </Button>
                  </div>
                </div>

                {/* Row 2: Name + Namespace */}
                <div className="truncate text-sm font-medium">
                  {forward.name}
                  <span className="text-xs text-muted-foreground font-normal ml-1.5">
                    {forward.namespace}
                  </span>
                </div>

                {/* Row 3: Port mapping */}
                <div className="flex items-center gap-2 rounded-md bg-muted px-2.5 py-1 w-fit">
                  <span className="text-xs font-mono">localhost:{forward.local_port}</span>
                  <ArrowRightLeft className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-mono">{forward.target_port}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stop Confirmation Dialog */}
      <AlertDialog open={!!stopDialog} onOpenChange={(open) => !open && setStopDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Port Forward?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the port forward for <strong>{stopDialog?.name}</strong>?
              This will disconnect any active connections.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
