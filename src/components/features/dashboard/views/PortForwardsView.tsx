"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type { PortForwardInfo, PortForwardHistoryItem } from "@/lib/types";

type RowData =
  | { kind: "active"; forward: PortForwardInfo }
  | { kind: "history"; item: PortForwardHistoryItem };

export function PortForwardsView() {
  const { forwards, stopForward } = usePortForward();
  const [stopDialog, setStopDialog] = useState<{ forwardId: string; name: string } | null>(null);

  const history = usePortForwardStore((s) => s.history);
  const removeHistoryItem = usePortForwardStore((s) => s.removeHistoryItem);
  const clearHistoryForCurrentCluster = usePortForwardStore((s) => s.clearHistoryForCurrentCluster);
  const restartFromHistory = usePortForwardStore((s) => s.restartFromHistory);
  const currentContext = useClusterStore((s) => s.currentCluster?.context);

  // Merge active forwards + stopped history, ordered by start time (oldest first).
  // Active forwards always take priority over their history counterpart.
  const rows = useMemo((): RowData[] => {
    const forwardMap = new Map(forwards.map((f) => [f.forward_id, f]));

    return history
      .filter((h) => h.cluster_context === currentContext)
      .sort((a, b) => a.started_at - b.started_at)
      .flatMap((item): RowData[] => {
        const live = forwardMap.get(item.forward_id);
        if (live) return [{ kind: "active", forward: live }];
        if (item.status !== "active") return [{ kind: "history", item }];
        return []; // orphaned active history entry — skip
      });
  }, [forwards, history, currentContext]);

  const handleDeleteActive = async (forwardId: string) => {
    const histItem = history.find((h) => h.forward_id === forwardId);
    await stopForward(forwardId);
    if (histItem) removeHistoryItem(histItem.id);
  };

  const confirmStop = () => {
    if (stopDialog) {
      stopForward(stopDialog.forwardId);
      setStopDialog(null);
    }
  };

  const activeCount = rows.filter((r) => r.kind === "active").length;
  const historyCount = rows.filter((r) => r.kind === "history").length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">Port Forwards</h1>
          {activeCount > 0 && (
            <Badge variant="secondary">{activeCount} active</Badge>
          )}
          {historyCount > 0 && (
            <Badge variant="outline" className="text-muted-foreground">{historyCount} stopped</Badge>
          )}
        </div>
        {historyCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistoryForCurrentCluster} className="text-muted-foreground">
            <Trash2 className="size-3.5" />
            Clear Stopped
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <ArrowRightLeft className="size-12 stroke-1" />
            <div className="text-center">
              <p className="font-medium">No port forwards</p>
              <p className="text-sm">Start a port forward from Services or Pods view</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-8 bg-background" />
                <TableHead className="bg-background text-xs font-medium tracking-wider">Name</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">Namespace</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">Kind</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">Ports</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) =>
                row.kind === "active" ? (
                  <ActiveRow
                    key={row.forward.forward_id}
                    forward={row.forward}
                    onStop={() => setStopDialog({ forwardId: row.forward.forward_id, name: row.forward.name })}
                    onDelete={() => handleDeleteActive(row.forward.forward_id)}
                  />
                ) : (
                  <HistoryRow
                    key={row.item.id}
                    item={row.item}
                    onRestart={() => restartFromHistory(row.item)}
                    onDelete={() => removeHistoryItem(row.item.id)}
                  />
                )
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog open={!!stopDialog} onOpenChange={(open) => !open && setStopDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Port Forward?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to stop the port forward for <strong>{stopDialog?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const statusDot: Record<string, string> = {
  connected: "bg-green-400",
  connecting: "bg-yellow-400 animate-pulse",
  reconnecting: "bg-orange-400 animate-pulse",
  error: "bg-red-400",
  disconnected: "bg-gray-400",
};

const statusTitle: Record<string, string> = {
  connected: "Connected",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  error: "Error",
  disconnected: "Disconnected",
};

interface ActiveRowProps {
  forward: PortForwardInfo;
  onStop: () => void;
  onDelete: () => void;
}

function ActiveRow({ forward, onStop, onDelete }: ActiveRowProps) {
  return (
    <TableRow>
      <TableCell>
        <span
          className={cn("size-2.5 rounded-full block", statusDot[forward.status] ?? "bg-gray-400")}
          title={statusTitle[forward.status] ?? forward.status}
        />
      </TableCell>
      <TableCell className="font-medium">{forward.name}</TableCell>
      <TableCell>{forward.namespace}</TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-[10px] font-normal">{forward.target_type}</Badge>
      </TableCell>
      <TableCell>
        <PortsPill localPort={forward.local_port} targetPort={forward.target_port} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onStop}
            title="Stop"
            className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
          >
            <Square className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title="Delete"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

interface HistoryRowProps {
  item: PortForwardHistoryItem;
  onRestart: () => void;
  onDelete: () => void;
}

function HistoryRow({ item, onRestart, onDelete }: HistoryRowProps) {
  const dot = item.status === "error" ? "bg-red-400" : "bg-gray-400";
  const dotTitle = item.status === "error" ? "Error" : "Stopped";

  return (
    <TableRow className="opacity-60">
      <TableCell>
        <span className={cn("size-2.5 rounded-full block", dot)} title={dotTitle} />
      </TableCell>
      <TableCell className="font-medium">{item.name}</TableCell>
      <TableCell>{item.namespace}</TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-[10px] font-normal">{item.target_type}</Badge>
      </TableCell>
      <TableCell>
        <PortsPill localPort={item.local_port} targetPort={item.target_port} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRestart}
            title="Start again"
            className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
          >
            <Play className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title="Delete"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function PortsPill({ localPort, targetPort }: { localPort: number; targetPort: number }) {
  return (
    <div className="flex items-center gap-1 font-mono text-xs bg-muted rounded px-2 py-0.5 w-fit">
      <span>{localPort}</span>
      <ArrowRightLeft className="size-3 text-muted-foreground shrink-0" />
      <span>{targetPort}</span>
    </div>
  );
}
