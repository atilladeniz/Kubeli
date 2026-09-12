"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useResourceDetail } from "../context/ResourceDetailContext";
import {
  formatRelativeAge,
  recentRestarts,
  recentWarnings,
  PANEL_LIMIT,
  RECENT_WINDOW_HOURS,
  type RestartEntry,
  type WarningEntry,
} from "./recent-activity";
import type { EventInfo, PodInfo } from "@/lib/types";

/**
 * The clock the panels date their rows against.
 *
 * Held in state and stepped once a minute so the ages stay truthful without
 * re-sorting on every watch update: a row must not jump while the user reads
 * it just because a list refreshed.
 */
function useCoarseNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function PanelShell({
  title,
  icon,
  count,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          {count > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ShowAllButton({
  total,
  expanded,
  onToggle,
  t,
}: {
  total: number;
  expanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (total <= PANEL_LIMIT) return null;
  return (
    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onToggle}>
      {expanded ? t("showLess") : t("showAll", { count: total })}
    </Button>
  );
}

export function RecentRestartsPanel({ pods }: { pods: PodInfo[] }) {
  const t = useTranslations("recent");
  const now = useCoarseNow();
  const [expanded, setExpanded] = useState(false);
  const { openResourceDetail } = useResourceDetail();

  const entries = useMemo(() => recentRestarts(pods, now), [pods, now]);
  const shown = expanded ? entries : entries.slice(0, PANEL_LIMIT);

  return (
    <PanelShell
      title={t("restarts", { hours: RECENT_WINDOW_HOURS })}
      icon={<RotateCcw className="size-4 text-yellow-500" />}
      count={entries.length}
      empty={t("noRestarts")}
    >
      {shown.map((entry) => (
        <RestartRow key={entry.key} entry={entry} now={now} onOpen={openResourceDetail} />
      ))}
      <ShowAllButton
        total={entries.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
      />
    </PanelShell>
  );
}

function RestartRow({
  entry,
  now,
  onOpen,
}: {
  entry: RestartEntry;
  now: number;
  onOpen: (type: string, name: string, namespace?: string) => unknown;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm" data-testid="restart-row">
      <button
        type="button"
        onClick={() => onOpen("pod", entry.name, entry.namespace)}
        className="truncate text-left hover:underline"
        title={`${entry.namespace}/${entry.name}`}
      >
        {entry.name}
      </button>
      <div className="flex items-center gap-2 shrink-0 text-xs">
        {entry.reason && (
          <span className="text-destructive font-mono">{entry.reason}</span>
        )}
        <Badge variant="outline" className="px-1.5 py-0 text-xs">
          {entry.restarts}x
        </Badge>
        <span className="text-muted-foreground tabular-nums w-8 text-right">
          {formatRelativeAge(entry.lastRestartAt, now)}
        </span>
      </div>
    </div>
  );
}

export function RecentWarningsPanel({
  events,
  scope = "all",
}: {
  events: EventInfo[];
  scope?: "all" | "cluster";
}) {
  const t = useTranslations("recent");
  const now = useCoarseNow();
  const [expanded, setExpanded] = useState(false);
  const { openResourceDetail } = useResourceDetail();

  const entries = useMemo(
    () => recentWarnings(events, now, { scope }),
    [events, now, scope]
  );
  const shown = expanded ? entries : entries.slice(0, PANEL_LIMIT);

  return (
    <PanelShell
      title={t("warnings", { hours: RECENT_WINDOW_HOURS })}
      icon={<AlertTriangle className="size-4 text-yellow-500" />}
      count={entries.length}
      empty={t("noWarnings")}
    >
      {shown.map((entry) => (
        <WarningRow key={entry.key} entry={entry} now={now} onOpen={openResourceDetail} />
      ))}
      <ShowAllButton
        total={entries.length}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        t={t}
      />
    </PanelShell>
  );
}

function WarningRow({
  entry,
  now,
  onOpen,
}: {
  entry: WarningEntry;
  now: number;
  onOpen: (type: string, name: string, namespace?: string) => unknown;
}) {
  return (
    <div className="space-y-0.5" data-testid="warning-row">
      <div className="flex items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => onOpen(entry.kind.toLowerCase(), entry.name, entry.namespace ?? undefined)}
          className="truncate text-left hover:underline"
          title={`${entry.kind}: ${entry.name}`}
        >
          <span className="text-muted-foreground mr-1.5 text-xs">{entry.kind}</span>
          {entry.name}
        </button>
        <div className="flex items-center gap-2 shrink-0 text-xs">
          {entry.count > 1 && (
            <Badge variant="outline" className="px-1.5 py-0 text-xs">
              {entry.count}x
            </Badge>
          )}
          <span className="text-muted-foreground tabular-nums w-8 text-right">
            {formatRelativeAge(entry.lastSeenAt, now)}
          </span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground truncate" title={entry.message}>
        <span className="text-yellow-500 mr-1.5">{entry.reason}</span>
        {entry.message}
      </p>
    </div>
  );
}
