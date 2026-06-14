"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Loader2, GitCompareArrows, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn, formatRelativeTime } from "@/lib/utils";
import { gitCommitUrl } from "@/lib/utils/git-commit-url";
import { isOperationInProgress } from "@/lib/utils/argocd-operation";
import { computeSideBySideDiff } from "@/lib/utils/text-diff";
import type { ArgoCDHistoryEntry, ArgoCDOperationState } from "@/lib/types";
import {
  getArgoCDApplicationHistory,
  getArgoCDOperationState,
  rollbackArgoCDApplication,
} from "@/lib/tauri/commands/argocd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArgoCDSourceDiffDialog } from "./ArgoCDSourceDiffDialog";
import { SourceDiffView } from "./SourceDiffView";

interface ArgoCDHistoryTabProps {
  name: string;
  namespace: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function shortenRevision(revision: string): string {
  if (revision.length > 8) return revision.slice(0, 8);
  return revision;
}

async function openExternal(url: string): Promise<void> {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } catch {
    // Opening the browser is best-effort; ignore failures.
  }
}

export function ArgoCDHistoryTab({ name, namespace }: ArgoCDHistoryTabProps) {
  const t = useTranslations();
  const [history, setHistory] = useState<ArgoCDHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollbackEntry, setRollbackEntry] = useState<ArgoCDHistoryEntry | null>(
    null,
  );
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [diffEntries, setDiffEntries] = useState<
    [ArgoCDHistoryEntry, ArgoCDHistoryEntry] | null
  >(null);
  const [operationState, setOperationState] =
    useState<ArgoCDOperationState | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const didInitSelection = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      setError(null);
      try {
        const [entries, op] = await Promise.all([
          getArgoCDApplicationHistory(name, namespace),
          getArgoCDOperationState(name, namespace).catch(() => null),
        ]);
        // Show newest first.
        const ordered = [...entries].reverse();
        setHistory(ordered);
        setOperationState(op);
        // Pre-select the current (newest) revision once, so comparing only
        // needs a second click.
        if (!didInitSelection.current && ordered.length > 0) {
          didInitSelection.current = true;
          setSelectedIds(new Set([ordered[0].id]));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!opts?.silent) setIsLoading(false);
      }
    },
    [name, namespace],
  );

  useEffect(() => {
    // Reset per-application selection state when switching apps.
    didInitSelection.current = false;
    setSelectedIds(new Set());
    fetchData();
  }, [fetchData]);

  const isOperationRunning = isOperationInProgress(operationState?.phase);

  // Poll the operation state after a rollback so progress is visible. Bounded,
  // and a no-op on demo clusters that have no controller to run the operation.
  const pollRollback = useCallback(async () => {
    setIsPolling(true);
    try {
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        if (!mountedRef.current) return;
        let op: ArgoCDOperationState | null = null;
        try {
          op = await getArgoCDOperationState(name, namespace);
        } catch {
          // Ignore transient errors while polling.
        }
        if (!mountedRef.current) return;
        setOperationState(op);
        const phase = op?.phase;
        // Stop on a terminal phase (Succeeded/Failed/Error); keep polling while
        // Running or Terminating.
        if (phase && !isOperationInProgress(phase)) break;
        if (!phase && i >= 1) break; // no operation appeared (e.g. demo cluster)
      }
      if (mountedRef.current) await fetchData({ silent: true });
    } finally {
      if (mountedRef.current) setIsPolling(false);
    }
  }, [name, namespace, fetchData]);

  const handleRollback = async () => {
    if (!rollbackEntry) return;
    setIsRollingBack(true);
    try {
      await rollbackArgoCDApplication(name, namespace, rollbackEntry.id);
      toast.success(
        t("argocd.rollbackSuccess", {
          revision: shortenRevision(rollbackEntry.revision),
        }),
      );
      setRollbackEntry(null);
      void pollRollback();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleCheckboxToggle = (entryId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        if (next.size >= 2) {
          // Remove the oldest selection (first inserted).
          const first = next.values().next().value!;
          next.delete(first);
        }
        next.add(entryId);
      }
      return next;
    });
  };

  const handleCompare = () => {
    if (selectedIds.size !== 2) return;
    const ids = Array.from(selectedIds);
    const a = history.find((e) => e.id === ids[0]);
    const b = history.find((e) => e.id === ids[1]);
    if (a && b) setDiffEntries([a, b]);
  };

  // Diff between the current source and the rollback target, previewed in the
  // confirm dialog so the user sees what the rollback will change.
  const rollbackDiff = useMemo(() => {
    if (!rollbackEntry || history.length === 0) return null;
    const current = history[0];
    if (current.id === rollbackEntry.id) return null;
    return computeSideBySideDiff(
      current.source_raw || "{}",
      rollbackEntry.source_raw || "{}",
    );
  }, [rollbackEntry, history]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">{error}</div>;
  }

  if (history.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {t("argocd.noHistory")}
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-4">
          {(isOperationRunning || isPolling) && (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              <span className="font-medium">
                {isOperationRunning
                  ? t("argocd.operationRunning")
                  : t("argocd.rollbackInProgress")}
              </span>
              {operationState?.message && (
                <span className="truncate text-muted-foreground">
                  {operationState.message}
                </span>
              )}
            </div>
          )}

          <div className="flex h-8 shrink-0 items-center justify-between gap-2">
            <span className="truncate text-xs text-muted-foreground">
              {t("argocd.compareHint")}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-2 text-xs"
              disabled={selectedIds.size !== 2}
              onClick={handleCompare}
            >
              <GitCompareArrows className="size-3.5" />
              {selectedIds.size > 0
                ? t("argocd.compareSelected", { count: selectedIds.size })
                : t("argocd.compare")}
            </Button>
          </div>

          {history.map((entry, idx) => {
            const commitUrl = gitCommitUrl(entry.source_repo, entry.revision);
            return (
              <div
                key={entry.id}
                role="checkbox"
                aria-checked={selectedIds.has(entry.id)}
                tabIndex={0}
                onClick={() => handleCheckboxToggle(entry.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleCheckboxToggle(entry.id);
                  }
                }}
                className={cn(
                  "cursor-pointer select-none rounded-md border p-3 transition-colors hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                  selectedIds.has(entry.id)
                    ? "border-primary bg-muted/40"
                    : "border-border/60",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      tabIndex={-1}
                      className="pointer-events-none"
                    />
                    <Badge variant="secondary" className="font-mono text-xs">
                      {shortenRevision(entry.revision)}
                    </Badge>
                    {commitUrl && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openExternal(commitUrl);
                            }}
                            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={t("argocd.openCommit")}
                          >
                            <ExternalLink className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("argocd.openCommit")}</TooltipContent>
                      </Tooltip>
                    )}
                    {idx === 0 && (
                      <Badge variant="default" className="text-xs">
                        {t("argocd.historyCurrent")}
                      </Badge>
                    )}
                  </div>
                  {idx > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 gap-1.5 text-xs"
                      disabled={isOperationRunning}
                      title={
                        isOperationRunning
                          ? t("argocd.rollbackBlocked")
                          : undefined
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        setRollbackEntry(entry);
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      {t("argocd.rollback")}
                    </Button>
                  )}
                </div>

                <div
                  className="mt-2 truncate text-xs text-muted-foreground"
                  title={entry.source_repo}
                >
                  {entry.source_repo}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("argocd.historyPath")}:{" "}
                    <span className="font-mono text-foreground">
                      {entry.source_path || "-"}
                    </span>
                  </span>
                  <span>
                    {t("argocd.historyTargetRev")}:{" "}
                    <span className="font-mono text-foreground">
                      {entry.source_target_revision || "-"}
                    </span>
                  </span>
                </div>

                {entry.deployed_at && (
                  <div
                    className="mt-1.5 text-xs text-muted-foreground"
                    title={formatDate(entry.deployed_at)}
                  >
                    {formatRelativeTime(entry.deployed_at, t("argocd.justNow"))}{" "}
                    · {formatDate(entry.deployed_at)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!rollbackEntry}
        onOpenChange={(open) => !open && setRollbackEntry(null)}
      >
        <AlertDialogContent className="sm:max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("argocd.rollbackConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("argocd.rollbackConfirmDescription", {
                name,
                revision: rollbackEntry
                  ? shortenRevision(rollbackEntry.revision)
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {rollbackDiff && rollbackEntry && (
            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <SourceDiffView
                diff={rollbackDiff}
                olderLabel={t("argocd.rollbackCurrent")}
                newerLabel={t("argocd.rollbackTarget", {
                  revision: shortenRevision(rollbackEntry.revision),
                })}
                emptyHint={t("argocd.rollbackNoSourceChange")}
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={isRollingBack}>
              {isRollingBack ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              {t("argocd.rollback")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ArgoCDSourceDiffDialog
        entries={diffEntries}
        onOpenChange={(open) => !open && setDiffEntries(null)}
      />
    </>
  );
}
