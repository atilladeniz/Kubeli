"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { DiffCell, SideBySideDiff } from "@/lib/utils/text-diff";
import { tokenizeJson, type JsonTokenKind } from "@/lib/utils/json-highlight";

const TOKEN_COLOR: Record<JsonTokenKind, string> = {
  key: "text-sky-700 dark:text-sky-300",
  string: "text-amber-700 dark:text-amber-300",
  number: "text-fuchsia-700 dark:text-fuchsia-300",
  keyword: "text-violet-700 dark:text-violet-300",
  punctuation: "text-muted-foreground",
  plain: "",
};

function LineNumber({
  cell,
  side,
}: {
  cell: DiffCell | null;
  side: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "min-w-[3ch] select-none py-1 pr-3 pl-4 text-right tabular-nums text-muted-foreground/70",
        side === "right" && "border-l border-border/60",
        cell?.type === "added" && "bg-emerald-500/15",
        cell?.type === "removed" && "bg-rose-500/15",
        !cell && "bg-muted/40",
      )}
    >
      {cell?.lineNumber ?? ""}
    </div>
  );
}

function CodeCell({ cell }: { cell: DiffCell | null }) {
  return (
    <div
      className={cn(
        "border-l-[3px] border-l-transparent py-1 pr-4 pl-3 whitespace-pre-wrap wrap-break-word",
        cell?.type === "added" && "border-l-emerald-500 bg-emerald-500/15",
        cell?.type === "removed" && "border-l-rose-500 bg-rose-500/15",
        !cell && "bg-muted/40",
      )}
    >
      {cell?.segments.map((seg, i) => (
        <span
          key={i}
          className={cn(
            seg.changed &&
              (cell.type === "added"
                ? "box-decoration-clone rounded-[3px] bg-emerald-500/30 px-1 py-px"
                : "box-decoration-clone rounded-[3px] bg-rose-500/30 px-1 py-px"),
          )}
        >
          {seg.text
            ? tokenizeJson(seg.text).map((tok, j) => (
                <span key={j} className={TOKEN_COLOR[tok.kind]}>
                  {tok.text}
                </span>
              ))
            : "​"}
        </span>
      ))}
    </div>
  );
}

interface SourceDiffViewProps {
  diff: SideBySideDiff;
  olderLabel: string;
  newerLabel: string;
  /** Shown when the two sources are identical (no additions or deletions). */
  emptyHint?: ReactNode;
}

/**
 * Side-by-side JSON diff grid: line numbers, vertical change bars, JSON syntax
 * coloring and word-level highlights. Renders the empty hint when there are no
 * changes (e.g. two history records that share the same source spec).
 */
export function SourceDiffView({
  diff,
  olderLabel,
  newerLabel,
  emptyHint,
}: SourceDiffViewProps) {
  const hasChanges = diff.stats.additions > 0 || diff.stats.deletions > 0;

  if (!hasChanges) {
    return (
      <div className="flex h-full min-h-32 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="grid min-w-full grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] font-mono text-xs leading-6">
      <div className="sticky top-0 z-10 col-span-2 border-b bg-muted/60 px-4 py-2 font-sans text-xs font-medium text-muted-foreground backdrop-blur">
        {olderLabel}
      </div>
      <div className="sticky top-0 z-10 col-span-2 border-b border-l border-border/60 bg-muted/60 px-4 py-2 font-sans text-xs font-medium text-muted-foreground backdrop-blur">
        {newerLabel}
      </div>

      {diff.rows.map((row, i) => (
        <div key={i} className="contents">
          <LineNumber cell={row.left} side="left" />
          <CodeCell cell={row.left} />
          <LineNumber cell={row.right} side="right" />
          <CodeCell cell={row.right} />
        </div>
      ))}
    </div>
  );
}
