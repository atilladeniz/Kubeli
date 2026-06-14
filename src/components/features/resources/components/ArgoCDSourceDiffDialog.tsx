"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { computeSideBySideDiff } from "@/lib/utils/text-diff";
import type { ArgoCDHistoryEntry } from "@/lib/types";
import { SourceDiffView } from "./SourceDiffView";

interface ArgoCDSourceDiffDialogProps {
  entries: [ArgoCDHistoryEntry, ArgoCDHistoryEntry] | null;
  onOpenChange: (open: boolean) => void;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString();
}

function shortenRevision(revision: string): string {
  if (revision.length > 8) return revision.slice(0, 8);
  return revision;
}

export function ArgoCDSourceDiffDialog({
  entries,
  onOpenChange,
}: ArgoCDSourceDiffDialogProps) {
  const t = useTranslations();

  // Sort so the older entry is the original (left), newer is the modified (right).
  const data = useMemo(() => {
    if (!entries) return null;
    const [older, newer] =
      entries[0].id < entries[1].id
        ? [entries[0], entries[1]]
        : [entries[1], entries[0]];
    const diff = computeSideBySideDiff(
      older.source_raw || "{}",
      newer.source_raw || "{}",
    );
    return { older, newer, diff };
  }, [entries]);

  if (!entries || !data) return null;
  const { older, newer, diff } = data;

  return (
    <Dialog open={!!entries} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[92vw] max-w-[1400px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1400px]">
        <DialogHeader className="shrink-0 gap-1.5 border-b py-3 pr-12 pl-4 text-left">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <GitCompareArrows className="size-4 shrink-0 text-muted-foreground" />
              {t("argocd.diffTitle")}
            </DialogTitle>
            <div className="flex shrink-0 items-center gap-1.5 font-mono text-xs font-medium">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-600 tabular-nums dark:text-emerald-400">
                +{diff.stats.additions}
              </span>
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-600 tabular-nums dark:text-rose-400">
                &minus;{diff.stats.deletions}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
            <span className="text-xs">{t("argocd.diffOlder")}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {shortenRevision(older.revision)}
            </Badge>
            {older.deployed_at && (
              <span className="text-xs text-muted-foreground/70">
                {formatDate(older.deployed_at)}
              </span>
            )}
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50" />
            <span className="text-xs">{t("argocd.diffNewer")}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              {shortenRevision(newer.revision)}
            </Badge>
            {newer.deployed_at && (
              <span className="text-xs text-muted-foreground/70">
                {formatDate(newer.deployed_at)}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto">
          <SourceDiffView
            diff={diff}
            olderLabel={t("argocd.diffOlder")}
            newerLabel={t("argocd.diffNewer")}
            emptyHint={t("argocd.diffNoChanges", {
              older: shortenRevision(older.revision),
              newer: shortenRevision(newer.revision),
            })}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
