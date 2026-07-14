"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatRelativeTime } from "@/lib/utils";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { usePortForwardStore } from "@/lib/stores/portforward-store";
import { useClusterStore } from "@/lib/stores/cluster-store";
import type {
  PortForwardInfo,
  PortForwardHistoryItem,
  PortForwardStopReason,
} from "@/lib/types";

type RowData =
  | { kind: "active"; forward: PortForwardInfo }
  | { kind: "history"; item: PortForwardHistoryItem };

type StatusFilter = "all" | "active" | "stopped";

export function PortForwardsView() {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");
  const { forwards, stopForward } = usePortForward();
  const [stopDialog, setStopDialog] = useState<{ forwardId: string; name: string } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<
    | { kind: "active"; forwardId: string; name: string }
    | { kind: "history"; itemId: string; name: string }
    | null
  >(null);
  const [filter, setFilter] = useState<StatusFilter>("all");

  const history = usePortForwardStore((s) => s.history);
  const removeHistoryItem = usePortForwardStore((s) => s.removeHistoryItem);
  const clearHistoryForCurrentCluster = usePortForwardStore((s) => s.clearHistoryForCurrentCluster);
  const restartFromHistory = usePortForwardStore((s) => s.restartFromHistory);
  const currentContext = useClusterStore((s) => s.currentCluster?.context);

  // Merge active forwards + stopped history, ordered by start time (oldest first).
  // Active forwards always take priority over their history counterpart.
  // Forwards without any history entry (e.g. after refreshForwards) are appended at the end.
  const rows = useMemo((): RowData[] => {
    const forwardMap = new Map(forwards.map((f) => [f.forward_id, f]));
    const clusterHistory = history.filter((h) => h.cluster_context === currentContext);
    const historyForwardIds = new Set(clusterHistory.map((h) => h.forward_id));

    const historyRows = clusterHistory
      .sort((a, b) => a.started_at - b.started_at)
      .flatMap((item): RowData[] => {
        const live = forwardMap.get(item.forward_id);
        if (live) return [{ kind: "active", forward: live }];
        if (item.status !== "active") return [{ kind: "history", item }];
        return []; // orphaned active history entry — skip
      });

    // Forwards with no history entry (e.g. after refreshForwards without a recorded start)
    const orphanRows: RowData[] = forwards
      .filter((f) => !historyForwardIds.has(f.forward_id))
      .map((forward) => ({ kind: "active", forward }));

    return [...historyRows, ...orphanRows];
  }, [forwards, history, currentContext]);

  const confirmDelete = async () => {
    if (!deleteDialog) return;
    if (deleteDialog.kind === "active") {
      const histItem = history.find((h) => h.forward_id === deleteDialog.forwardId);
      const stopped = await stopForward(deleteDialog.forwardId);
      if (stopped && histItem) removeHistoryItem(histItem.id);
    } else {
      removeHistoryItem(deleteDialog.itemId);
    }
    setDeleteDialog(null);
  };

  const confirmStop = async () => {
    if (!stopDialog) return;
    const stopped = await stopForward(stopDialog.forwardId);
    setStopDialog(null);
    if (!stopped) toast.error(t("stopFailed"));
  };

  const activeCount = rows.filter((r) => r.kind === "active").length;
  const historyCount = rows.filter((r) => r.kind === "history").length;

  const visibleRows = useMemo(() => {
    if (filter === "active") return rows.filter((r) => r.kind === "active");
    if (filter === "stopped") return rows.filter((r) => r.kind === "history");
    return rows;
  }, [rows, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex min-h-8 items-center gap-3 flex-wrap">
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterPill
              label={tc("all")}
              count={rows.length}
              isActive={filter === "all"}
              onClick={() => setFilter("all")}
              color="default"
            />
            <FilterPill
              label={t("active")}
              count={activeCount}
              isActive={filter === "active"}
              onClick={() => setFilter("active")}
              color="green"
            />
            <FilterPill
              label={t("stopped")}
              count={historyCount}
              isActive={filter === "stopped"}
              onClick={() => setFilter("stopped")}
              color="default"
            />
          </div>
        </div>
        {historyCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearHistoryForCurrentCluster}
            className="h-8 text-xs text-muted-foreground"
          >
            <Trash2 className="size-3.5" />
            {t("clearStopped")}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {visibleRows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
            <ArrowRightLeft className="size-12 stroke-1" />
            <div className="text-center">
              <p className="font-medium">{t("noForwards")}</p>
              <p className="text-sm">{t("noForwardsHint")}</p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-14 bg-background text-xs font-medium tracking-wider">{tc("status")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{tc("name")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnNamespace")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnKind")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider">{t("columnPorts")}</TableHead>
                <TableHead className="bg-background text-xs font-medium tracking-wider text-right">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row) =>
                row.kind === "active" ? (
                  <ActiveRow
                    key={row.forward.forward_id}
                    forward={row.forward}
                    onStop={() => setStopDialog({ forwardId: row.forward.forward_id, name: row.forward.name })}
                    onDelete={() => setDeleteDialog({ kind: "active", forwardId: row.forward.forward_id, name: row.forward.name })}
                  />
                ) : (
                  <HistoryRow
                    key={row.item.id}
                    item={row.item}
                    onRestart={() => restartFromHistory(row.item)}
                    onDelete={() => setDeleteDialog({ kind: "history", itemId: row.item.id, name: row.item.name })}
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
            <AlertDialogTitle>{t("stopConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("stopConfirmDesc", { name: stopDialog?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("stop")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDesc", { name: deleteDialog?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
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

interface ActiveRowProps {
  forward: PortForwardInfo;
  onStop: () => void;
  onDelete: () => void;
}

function ActiveRow({ forward, onStop, onDelete }: ActiveRowProps) {
  const t = useTranslations("portForward");
  const tc = useTranslations("common");

  const statusTitles: Record<string, string> = {
    connected: t("connected"),
    connecting: t("connecting"),
    reconnecting: t("reconnecting"),
    error: tc("error"),
    disconnected: t("disconnected"),
  };

  return (
    <TableRow>
      <TableCell>
        <span
          className={cn("size-2.5 rounded-full block", statusDot[forward.status] ?? "bg-gray-400")}
          title={statusTitles[forward.status] ?? forward.status}
        />
      </TableCell>
      <TableCell className="font-medium">{forward.name}</TableCell>
      <TableCell>{forward.namespace}</TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs font-normal">{forward.target_type}</Badge>
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
            title={t("stop")}
            className="text-orange-500 hover:text-orange-600 hover:bg-orange-500/10"
          >
            <Square className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title={tc("delete")}
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
  const t = useTranslations("portForward");
  const tc = useTranslations("common");
  const dot = item.status === "error" ? "bg-red-400" : "bg-gray-400";

  const reasonLabel = stopReasonLabel(item.stop_reason, item.status, t, tc);
  const agoLabel =
    item.stopped_at !== undefined
      ? t("stoppedAgo", { time: formatRelativeTime(item.stopped_at, t("justNow")) })
      : undefined;
  const dotTitle = agoLabel ? `${reasonLabel} • ${agoLabel}` : reasonLabel;

  return (
    <TableRow className="opacity-60">
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn("size-2.5 rounded-full block cursor-default", dot)}
              aria-label={dotTitle}
            />
          </TooltipTrigger>
          <TooltipContent>{dotTitle}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell className="font-medium">
        <div>{item.name}</div>
        {item.error_message && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-xs text-red-500/80 truncate max-w-[280px] cursor-default">
                {item.error_message}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm wrap-break-word">
              {item.error_message}
            </TooltipContent>
          </Tooltip>
        )}
      </TableCell>
      <TableCell>{item.namespace}</TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize text-xs font-normal">{item.target_type}</Badge>
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
            title={t("startAgain")}
            className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
          >
            <Play className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            title={t("deleteFromHistory")}
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

function stopReasonLabel(
  reason: PortForwardStopReason | undefined,
  status: PortForwardHistoryItem["status"],
  t: (key: string) => string,
  tc: (key: string) => string,
): string {
  switch (reason) {
    case "user":
      return t("stopReasonUser");
    case "podDied":
      return t("stopReasonPodDied");
    case "error":
      return t("stopReasonError");
    case "disconnected":
      return t("stopReasonDisconnected");
    default:
      return status === "error" ? tc("error") : t("disconnected");
  }
}

interface FilterPillProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
  color: "default" | "green";
}

function FilterPill({ label, count, isActive, onClick, color }: FilterPillProps) {
  const colorClasses = {
    default: isActive
      ? "border-foreground bg-foreground text-background dark:border-zinc-500 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600 classic-dark:border-zinc-500 classic-dark:bg-zinc-700 classic-dark:text-zinc-100 classic-dark:hover:bg-zinc-600"
      : "border-border/70 bg-muted text-foreground/80 hover:bg-muted/80",
    green: isActive
      ? "border-green-600 bg-green-600 text-white hover:bg-green-500 dark:border-green-500/70 dark:bg-green-500/30 dark:text-green-100 dark:hover:bg-green-500/35 classic-dark:border-green-500/70 classic-dark:bg-green-500/30 classic-dark:text-green-100 classic-dark:hover:bg-green-500/35"
      : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-700/60 dark:bg-green-500/15 dark:text-green-300 dark:hover:bg-green-500/25 classic-dark:border-green-700/60 classic-dark:bg-green-500/15 classic-dark:text-green-300 classic-dark:hover:bg-green-500/25",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        colorClasses[color]
      )}
    >
      {label}
      <span className={cn("tabular-nums", isActive ? "opacity-90" : "opacity-80")}>{count}</span>
    </button>
  );
}
