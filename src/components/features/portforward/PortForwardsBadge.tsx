"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightLeft, ExternalLink, Maximize2, Search, SearchX, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { TruncateTooltip } from "@/components/ui/truncate-tooltip";
import { cn } from "@/lib/utils";
import { usePortForward } from "@/lib/hooks/usePortForward";
import { useClusterStore } from "@/lib/stores/cluster-store";
import { ClusterTag } from "@/components/features/dashboard/views/PortForwardRows";

async function openForwardInBrowser(port: number) {
  try {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(`http://localhost:${port}`);
  } catch (err) {
    console.error("Failed to open browser:", err);
  }
}

interface PortForwardsBadgeProps {
  /** Optional "open the full page" affordance, shown as an expand icon. */
  onExpand?: () => void;
}

/**
 * Violet count badge for active port forwards across all clusters. Clicking it
 * opens a compact popover listing each forward with its cluster tag — usable
 * even when disconnected (the cluster-select screen has no dashboard route).
 * Renders nothing when there are no forwards.
 */
export function PortForwardsBadge({ onExpand }: PortForwardsBadgeProps) {
  const tNav = useTranslations("navigation");
  const tc = useTranslations("common");
  const { forwards, stopForward } = usePortForward();
  const clusters = useClusterStore((s) => s.clusters);
  const [query, setQuery] = useState("");

  const clusterLabel = useMemo(() => {
    const nameByContext = new Map(clusters.map((c) => [c.context, c.name || c.context]));
    return (context: string) => {
      if (!context) return undefined;
      return nameByContext.get(context) ?? context;
    };
  }, [clusters]);

  // Show the search only once the list is long enough to warrant it.
  const showSearch = forwards.length > 5;
  const visibleForwards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forwards;
    return forwards.filter((f) => {
      const label = clusterLabel(f.cluster_context) ?? "";
      return (
        f.name.toLowerCase().includes(q) ||
        label.toLowerCase().includes(q) ||
        String(f.local_port).includes(q) ||
        String(f.target_port).includes(q)
      );
    });
  }, [forwards, query, clusterLabel]);

  if (forwards.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={tNav("activePortForwards")}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-600 transition-colors hover:bg-violet-500/25 dark:text-violet-300 classic-dark:text-violet-300"
        >
          <ArrowRightLeft className="size-3" />
          <span className="hidden sm:inline">{tNav("activePortForwards")}</span>
          <span className="rounded-full bg-violet-500/20 px-1.5 tabular-nums">
            {forwards.length}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={8} className="w-[26rem] p-2.5">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-medium text-muted-foreground">
            {tNav("activePortForwards")}
          </span>
          {onExpand && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
              onClick={onExpand}
              aria-label={tNav("portForwardsAll")}
            >
              <Maximize2 className="size-3" />
            </Button>
          )}
        </div>
        {showSearch && (
          <div className="relative mb-2 px-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tc("search")}
              className="h-8 pl-8 pr-8 text-sm"
            />
            {query.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-2 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                onClick={() => setQuery("")}
                aria-label={tc("clear")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>
        )}
        <div className="max-h-96 space-y-1.5 overflow-y-auto">
          {visibleForwards.length === 0 && (
            <Empty className="gap-2 border-none p-6 md:p-6">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="mb-0">
                  <SearchX />
                </EmptyMedia>
                <EmptyTitle className="text-sm">{tc("noResults")}</EmptyTitle>
                <EmptyDescription className="block max-w-full truncate text-xs">
                  {tNav("noForwardsMatch", {
                    query:
                      query.trim().length > 32
                        ? `${query.trim().slice(0, 32)}…`
                        : query.trim(),
                  })}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          {visibleForwards.map((forward) => {
            const label = clusterLabel(forward.cluster_context);
            return (
              <div
                key={forward.forward_id}
                className="flex items-center gap-2.5 rounded-md bg-muted/50 px-2.5 py-2.5 text-sm"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    forward.status === "connected"
                      ? "bg-green-400"
                      : forward.status === "connecting"
                        ? "bg-yellow-400 animate-pulse"
                        : forward.status === "reconnecting"
                          ? "bg-orange-400 animate-pulse"
                          : "bg-red-400",
                  )}
                />
                {label && (
                  <span className="max-w-[7.5rem] shrink-0 truncate">
                    <ClusterTag label={label} />
                  </span>
                )}
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <TruncateTooltip
                    content={forward.name}
                    className="min-w-0 flex-1 truncate font-medium"
                  />
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    :{forward.local_port}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 p-0 text-muted-foreground hover:bg-accent hover:text-foreground"
                    onClick={() => void openForwardInBrowser(forward.local_port)}
                    aria-label={`Open localhost:${forward.local_port}`}
                  >
                    <ExternalLink className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => void stopForward(forward.forward_id)}
                    aria-label={`Stop ${forward.name} port forward`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
