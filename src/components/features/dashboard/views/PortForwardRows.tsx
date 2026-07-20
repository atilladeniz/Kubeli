"use client";

import { useTranslations } from "next-intl";
import { ArrowRightLeft, Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  PortForwardInfo,
  PortForwardHistoryItem,
  PortForwardStopReason,
} from "@/lib/types";

export const statusDot: Record<string, string> = {
  connected: "bg-green-400",
  connecting: "bg-yellow-400 animate-pulse",
  reconnecting: "bg-orange-400 animate-pulse",
  error: "bg-red-400",
  disconnected: "bg-gray-400",
};

/** Purple pill used to tag a forward with the cluster it belongs to. */
export function ClusterTag({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className="border-violet-300 bg-violet-50 text-violet-700 text-xs font-normal dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-300 classic-dark:border-violet-500/50 classic-dark:bg-violet-500/15 classic-dark:text-violet-300"
    >
      {label}
    </Badge>
  );
}

interface ActiveRowProps {
  forward: PortForwardInfo;
  clusterLabel?: string;
  onStop: () => void;
  onDelete: () => void;
}

export function ActiveRow({ forward, clusterLabel, onStop, onDelete }: ActiveRowProps) {
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
      {clusterLabel !== undefined && (
        <TableCell>
          <ClusterTag label={clusterLabel} />
        </TableCell>
      )}
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
  clusterLabel?: string;
  /** Set when restart is unavailable; explains why and disables the button. */
  restartDisabledReason?: string;
  onRestart: () => void;
  onDelete: () => void;
}

export function HistoryRow({
  item,
  clusterLabel,
  restartDisabledReason,
  onRestart,
  onDelete,
}: HistoryRowProps) {
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
      {clusterLabel !== undefined && (
        <TableCell>
          <ClusterTag label={clusterLabel} />
        </TableCell>
      )}
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
            disabled={!!restartDisabledReason}
            title={restartDisabledReason ?? t("startAgain")}
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

export function PortsPill({ localPort, targetPort }: { localPort: number; targetPort: number }) {
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

export function FilterPill({ label, count, isActive, onClick, color }: FilterPillProps) {
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
