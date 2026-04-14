"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Loader2, GitCompareArrows } from "lucide-react";
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
import type { ArgoCDHistoryEntry } from "@/lib/types";
import {
  getArgoCDApplicationHistory,
  rollbackArgoCDApplication,
} from "@/lib/tauri/commands/argocd";
import { ArgoCDSourceDiffDialog } from "./ArgoCDSourceDiffDialog";

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

export function ArgoCDHistoryTab({ name, namespace }: ArgoCDHistoryTabProps) {
  const t = useTranslations();
  const [history, setHistory] = useState<ArgoCDHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollbackEntry, setRollbackEntry] = useState<ArgoCDHistoryEntry | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [diffEntries, setDiffEntries] = useState<[ArgoCDHistoryEntry, ArgoCDHistoryEntry] | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const entries = await getArgoCDApplicationHistory(name, namespace);
      // Show newest first
      setHistory([...entries].reverse());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, [name, namespace]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleRollback = async () => {
    if (!rollbackEntry) return;
    setIsRollingBack(true);
    try {
      await rollbackArgoCDApplication(name, namespace, rollbackEntry.revision);
      toast.success(t("argocd.rollbackSuccess", { revision: shortenRevision(rollbackEntry.revision) }));
      setRollbackEntry(null);
      fetchHistory();
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
          // Remove the oldest selection (first inserted)
          const first = next.values().next().value!;
          next.delete(first);
        }
        next.add(entryId);
      }
      return next;
    });
  };

  const handleRevisionClick = (entry: ArgoCDHistoryEntry) => {
    if (history.length < 2) return;
    const newest = history[0];
    if (entry.id === newest.id) return;
    setDiffEntries([entry, newest]);
  };

  const handleCompare = () => {
    if (selectedIds.size !== 2) return;
    const ids = Array.from(selectedIds);
    const a = history.find((e) => e.id === ids[0]);
    const b = history.find((e) => e.id === ids[1]);
    if (a && b) setDiffEntries([a, b]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">{error}</div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        {t("argocd.noHistory")}
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-2 font-medium w-8">
                  {selectedIds.size === 2 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs px-2"
                      onClick={handleCompare}
                    >
                      <GitCompareArrows className="size-3.5" />
                      {t("argocd.compareSelected", { count: selectedIds.size })}
                    </Button>
                  ) : selectedIds.size === 1 ? (
                    <span className="text-xs px-2">
                      {t("argocd.compareSelected", { count: selectedIds.size })}
                    </span>
                  ) : null}
                </th>
                <th className="pb-2 pr-4 font-medium">{t("argocd.historyRevision")}</th>
                <th className="pb-2 pr-4 font-medium">{t("argocd.historySource")}</th>
                <th className="pb-2 pr-4 font-medium">{t("argocd.historyPath")}</th>
                <th className="pb-2 pr-4 font-medium">{t("argocd.historyTargetRev")}</th>
                <th className="pb-2 pr-4 font-medium">{t("argocd.historyDeployed")}</th>
                <th className="pb-2 font-medium">{t("argocd.historyActions")}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry, idx) => (
                <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 pr-2">
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => handleCheckboxToggle(entry.id)}
                    />
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs cursor-pointer hover:bg-accent"
                        onClick={() => handleRevisionClick(entry)}
                      >
                        {shortenRevision(entry.revision)}
                      </Badge>
                      {idx === 0 && (
                        <Badge variant="default" className="text-xs">
                          {t("argocd.historyCurrent")}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 max-w-[200px] truncate" title={entry.source_repo}>
                    {entry.source_repo}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">
                    {entry.source_path || "-"}
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">
                    {entry.source_target_revision || "-"}
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">
                    {entry.deployed_at ? formatDate(entry.deployed_at) : "-"}
                  </td>
                  <td className="py-2.5">
                    {idx > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={() => setRollbackEntry(entry)}
                      >
                        <RotateCcw className="size-3.5" />
                        {t("argocd.rollback")}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      <AlertDialog open={!!rollbackEntry} onOpenChange={(open) => !open && setRollbackEntry(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("argocd.rollbackConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("argocd.rollbackConfirmDescription", {
                name,
                revision: rollbackEntry ? shortenRevision(rollbackEntry.revision) : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRollingBack}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleRollback} disabled={isRollingBack}>
              {isRollingBack ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="size-4 mr-2" />
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
