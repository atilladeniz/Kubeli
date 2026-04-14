"use client";

import { DiffEditor } from "@monaco-editor/react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useUIStore } from "@/lib/stores/ui-store";
import type { ArgoCDHistoryEntry } from "@/lib/types";

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
  const { resolvedTheme } = useUIStore();

  if (!entries) return null;

  // Sort so older entry is first (original), newer is second (modified)
  const sorted =
    entries[0].id < entries[1].id
      ? [entries[0], entries[1]]
      : [entries[1], entries[0]];
  const [older, newer] = sorted;

  const monacoTheme =
    resolvedTheme === "dark" || resolvedTheme === "classic-dark"
      ? "vs-dark"
      : "light";

  return (
    <Dialog open={!!entries} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("argocd.diffTitle")}
          </DialogTitle>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>{t("argocd.diffOlder")}:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {shortenRevision(older.revision)}
              </Badge>
              {older.deployed_at && (
                <span className="text-xs">
                  ({formatDate(older.deployed_at)})
                </span>
              )}
            </div>
            <span>→</span>
            <div className="flex items-center gap-1.5">
              <span>{t("argocd.diffNewer")}:</span>
              <Badge variant="secondary" className="font-mono text-xs">
                {shortenRevision(newer.revision)}
              </Badge>
              {newer.deployed_at && (
                <span className="text-xs">
                  ({formatDate(newer.deployed_at)})
                </span>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 border rounded-md overflow-hidden">
          <DiffEditor
            original={older.source_raw || "{}"}
            modified={newer.source_raw || "{}"}
            language="json"
            theme={monacoTheme}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 13,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              renderOverviewRuler: false,
              contextmenu: false,
              codeLens: false,
              folding: true,
              lineNumbers: "on",
              scrollbar: {
                vertical: "visible",
                horizontal: "visible",
                useShadows: false,
                verticalScrollbarSize: 10,
                horizontalScrollbarSize: 10,
              },
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
